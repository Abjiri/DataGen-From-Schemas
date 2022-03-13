// Gramática de JSON Schema para "DataGen from Schemas" -----

{
  let depth = 0
  let $defs = false
  let ids = []

  let genericKeys = ["type","enum","const"]
  let annotationKeys = ["title","description","default","examples","readOnly","writeOnly","deprecated","$comment"]
  let mediaKeys = ["contentMediaType","contentEncoding","contentSchema"]
  let schemaKeys = ["allOf","anyOf","oneOf","not","dependentRequired","dependentSchemas","if","then","else"]
  let structuringKeys = ["$schema","$id","$anchor","$ref","$defs"]

  let stringKeys = ["minLength","maxLength","pattern","format"]
  let numericKeys = ["multipleOf","minimum","exclusiveMinimum","maximum","exclusiveMaximum"]
  let objectKeys = ["properties","patternProperties","additionalProperties","unevaluatedProperties","required","propertyNames","minProperties","maxProperties"]
  let arrayKeys = ["items","prefixItems","unevaluatedItems","contains","minContains","maxContains","minItems","maxItems","uniqueItems"]

  // chave só permitida na raiz
  const atRoot = kw => (($defs && depth==3) || depth==1) ? true : error(`A chave '${kw}' só é permitida ao nível da raiz!`)
  // todos os ids devem ser únicos
  const newId = id => !ids.includes(id) ? true : error(`Todas as propriedades '$id' devem ser únicas! Há mais do que uma (sub)schema cujo '$id' é '${id}'.`)
  // verificar se objeto tem todas as propriedades em questão
  const hasAll = (k, obj) => typeof k == "string" ? k in obj : k.every(key => key in obj)
  // verificar se objeto alguma das propriedades em questão
  const hasAny = (k, obj) => k.some(key => key in obj)

  // fazer todas as verificações necessárias para garantir que a schema está bem escrita
  function checkSchema(s) {
    s = determineType(s)
    return checkKeysByType(s) && checkRangeKeywords(s) && checkRequiredProps(s) && checkMaxProperties(s) && checkContains(s) && 
           checkArrayLength(s) && checkEnumArray(s) && checkConstType(s) && checkDependentRequired(s) && checkIfThenElse(s) && checkContentSchema(s)
  }

  // formatar os dados para a estrutura intermédia pretendida
  function structureSchemaData(obj) {
    let schema = {type: {def: true}}

    if (obj === null) return true

    for (let k of obj.type) schema.type[k] = {}
    delete obj.type

    for (let k in obj) {
      if (numericKeys.includes(k)) {
        if ("integer" in schema.type) schema.type.integer[k] = obj[k]
        if ("number" in schema.type) schema.type.number[k] = obj[k]
      }
      else if (stringKeys.includes(k)) schema.type.string[k] = obj[k]
      else if (objectKeys.includes(k)) schema.type.object[k] = obj[k]
      else if (arrayKeys.includes(k)) schema.type.array[k] = obj[k]
      else schema[k] = obj[k]
    }

    return schema
  }

  // validar todas as chaves de cada tipo entre si, para garantir que são coerentes
  function validateSchemaData(obj) {
    let valid = true

    for (let k in obj.type) {
      switch (k) {
        case "integer": valid = dslNumericTypes(obj.type.integer, k); break
        case "number": valid = dslNumericTypes(obj.type.number, k); break
      }

      if (valid !== true) return valid
    }

    return obj
  }

  // determinar o tipo do valor, se a chave 'type' não for especificada
  function determineType(obj) {
    if (obj === null) return {type: ["string"]}

    if (!hasAll("type", obj)) {
      let type = []

      for (let k in obj) {
        if (stringKeys.includes(k)) type.push("string")
        if (numericKeys.includes(k)) type.push("number")
        if (objectKeys.includes(k)) type.push("object")
        if (arrayKeys.includes(k)) type.push("array")
      }

      obj.type = type
    }

    return obj
  }

  // verificar que não se usam chaves específicas a tipos nos tipos errados
  function checkKeysByType(obj) {
    let keywords = genericKeys.concat(annotationKeys, mediaKeys, schemaKeys, structuringKeys)
    //if (!hasAll("type", obj) && !Object.keys(obj).every(k => keywords.includes(k))) return error("Especifique o tipo deste valor através da chave 'type'!")
    for (let i = 0; i < obj.type.length; i++) {
      switch (obj.type[i]) {
        case "string": keywords = keywords.concat(stringKeys); break
        case "integer": case "number": keywords = keywords.concat(numericKeys); break
        case "object": keywords = keywords.concat(objectKeys); break
        case "array": keywords = keywords.concat(arrayKeys); break
      }
    }

    for (let k in obj)
      if (!keywords.includes(k)) return error(`O tipo {${obj.type.join(", ")}} não suporta a chave '${k}'!`)
        
    return true
  }

  // verificar a coerência das chaves de alcance de tipos númericos e string
  function checkRangeKeywords(obj) {
    let min = null, max = null, emin = null, emax = null

    if (hasAll("minimum", obj)) min = obj.minimum
    if (hasAll("maximum", obj)) max = obj.maximum
    if (hasAll("exclusiveMinimum", obj)) emin = obj.exclusiveMinimum
    if (hasAll("exclusiveMaximum", obj)) emax = obj.exclusiveMaximum

    if (min !== null && max !== null && min > max) return error(`O valor da chave 'minimum' deve ser <= ao da chave 'maximum'!`)
    if (min !== null && emax !== null && min >= emax) return error(`O valor da chave 'minimum' deve ser < ao da chave 'exclusiveMaximum'!`)
    if (max !== null && emin !== null && max <= emin) return error(`O valor da chave 'maximum' deve ser > ao da chave 'exclusiveMinimum'!`)

    if (min !== null && emin !== null) {
      if (emin >= min) delete obj.minimum
      else delete obj.exclusiveMinimum
    }
    if (max !== null && emax !== null) {
      if (emax <= max) delete obj.maximum
      else delete obj.exclusiveMaximum
    }

    if (hasAll(["maxLength", "minLength"], obj) && obj.minLength > obj.maxLength) return error(`O valor da chave 'minLength' deve ser <= ao da chave 'maxLength'!`)

    return true
  }

  // verificar a coerência do array de propriedades da chave 'required'
  function checkRequiredProps(obj) {
    if (hasAll("required", obj)) {
      if (obj.required.length != [...new Set(obj.required)].length) return error("Todos os elementos do array da chave 'required' devem ser únicos!")
      
      let properties = hasAll("properties", obj) ? Object.keys(obj.properties) : []
      let patternProperties = hasAll("patternProperties", obj) ? Object.keys(obj.patternProperties).map(p => new RegExp(p)) : []

      for (let i = 0; i < obj.required.length; i++) {
        if (properties.includes(obj.required[i])) ;
        else if (patternProperties.some(p => p.test(obj.required[i]))) ;
        else if (!hasAny(["additionalProperties", "unevaluatedProperties"], obj)) ;
        else if (hasAll("additionalProperties", obj) && obj.additionalProperties !== false) ;
        else if (!hasAll("additionalProperties", obj) && hasAll("unevaluatedProperties", obj) && obj.unevaluatedProperties !== false) ;
        else return error(`A propriedade '${obj.required[i]}' referida na chave 'required' não é permitida no objeto pela schema!`)
      }
    }
    return true
  }

  // verificar que a schema dada pela chave 'propertyNames' é do tipo string
  function checkPropertyNamesType(obj) {
    if (obj === false || (typeof obj !== "boolean" && hasAll("type", obj) && Object.keys(obj.type).some(k => !["def","string"].includes(k))))
      return error(`Como as chaves de objetos devem ser sempre strings, está implícito que a schema dada pela chave 'propertyNames' deve ser do tipo 'string' apenas!`)
    return true
  }

  // verificar que as chaves 'required' e de tamanho do objeto não se contradizem
  function checkMaxProperties(obj) {
    if (hasAll(["required", "maxProperties"], obj))
      if (obj.maxProperties < obj.required.length) return error(`A chave 'maxProperties' define que o objeto deve ter, no máximo, ${obj.maxProperties} propriedades, contudo a chave 'required' define que há ${obj.required.length} propriedades obrigatórias!`)

    if (hasAll("minProperties", obj)) {
      if (!hasAll("patternProperties", obj) && (
        (hasAll("additionalProperties", obj) && obj.additionalProperties === false) || 
        (!hasAll("additionalProperties", obj) && hasAll("unevaluatedProperties", obj) && obj.unevaluatedProperties === false))) {
          let properties = hasAll("properties", obj) ? Object.keys(obj.properties).length : 0
          if (properties < obj.minProperties) return error(`A chave 'minProperties' define que o objeto deve ter, no mínimo, ${obj.minProperties} propriedades, contudo a schema permite um máximo de ${properties} propriedades no objeto!`)
      }
    }
    return true
  }

  // verificar a coerência das chaves de contenção 
  function checkContains(obj) {
    if (!hasAll("contains", obj)) {
      if (hasAny(["minContains","maxContains"], obj)) return error("As chaves 'minContains' e 'maxContains' só podem ser usadas em conjunto com a chave 'contains'!")
    }
    else if (hasAll(["minContains","maxContains"], obj) && obj.minContains > obj.maxContains) return error("O valor da chave 'minContains' deve ser <= ao da chave 'maxContains'!")

    return true
  }

  // verificar a coerência das chaves de comprimento de arrays
  function checkArrayLength(obj) {
    if (hasAll(["prefixItems","minItems","items"], obj) && obj.items === false && obj.minItems > obj.prefixItems.length)
      return error(`A chave 'minItems' define que o array deve ter, no mínimo, ${obj.minItems} elementos, contudo a chave 'prefixItems' especifica apenas ${obj.prefixItems.length} elementos e a chave 'items' proibe elementos extra para além desses!`)

    if (hasAll(["minItems","maxItems"], obj) && obj.minItems > obj.maxItems) return error("O valor da chave 'minItems' deve ser <= ao da chave 'maxItems'!")
    return true
  }

  // verificar que os elementos do array da chave 'enum' são todos únicos (não funciona para elementos array/objeto) e do tipo correto
  function checkEnumArray(obj) {
    if (hasAll("enum", obj)) {
      if (!obj.enum.length) return error("O array da chave 'enum' deve ter, no mínimo, um elemento!")
      if (obj.enum.length != [...new Set(obj.enum)].length) return error("Todos os elementos do array da chave 'enum' devem ser únicos!")

      if (hasAll("type", obj) && obj.type.length > 0) {
        for (let i = 0; i < obj.enum.length; i++) {
          let valid = false

          for (let j = 0; j < obj.type.length; j++) {
            if (obj.type[j] == "array" && Array.isArray(obj.enum[i])) {valid = true; break}
            else if (obj.type[j] == "null" && obj.enum[i] === null) {valid = true; break}
            else if (obj.type[j] == "integer" && Number.isInteger(obj.enum[i])) {valid = true; break}
            else if (typeof obj.enum[i] == obj.type[j]) {valid = true; break}
          }

          if (!valid) return error(`Todos os elementos do array da chave 'enum' devem ser do tipo {${obj.type.join(", ")}}, segundo definido pela chave 'type'!`)
        }
      }
    }
    return true
  }

  // verificar se o valor da chave 'const' é do tipo correto
  function checkConstType(obj) {
    if (hasAll(["const","type"], obj)) {
      let valid = false

      for (let j = 0; j < obj.type.length; j++) {
        if (obj.type[j] == "array" && Array.isArray(obj.const)) {valid = true; break}
        else if (obj.type[j] == "null" && obj.const === null) {valid = true; break}
        else if (obj.type[j] == "integer" && Number.isInteger(obj.const)) {valid = true; break}
        else if (typeof obj.const == obj.type[j]) {valid = true; break}
      }

      if (!valid) return error(`O valor da chave 'const' deve ser do tipo {${obj.type.join(", ")}}, segundo definido pela chave 'type'!`)
    }
    return true
  }

  // verificar os requisitos necessários para se considerar a chave 'contentSchema'
  function checkContentSchema(obj) {
    if (hasAll("contentSchema", obj) && !(hasAll(["type","contentMediaType"], obj) && obj.type.includes("string")))
      return error("O valor da chave 'contentSchema' só é considerado se a instância for uma string e a chave 'contentMediaType' estiver presente!")
    return true
  }

  // verificar que todas as propriedades referidas na chave 'dependentRequired' são válidas
  function checkDependentRequired(obj) {
    if (hasAll(["properties","dependentRequired"], obj)) {
      let props = Object.keys(obj.properties)

      for (let key in obj.dependentRequired) {
        if (!props.includes(key)) return error(`A propriedade '${key}' referida na chave 'dependentRequired' é inválida porque não foi definida na chave 'properties'!`)

        // remover propriedades repetidas
        obj.dependentRequired[key] = [...new Set(obj.dependentRequired[key])]
        let array_value = obj.dependentRequired[key]

        // se tiver a propriedade dependente dela mesma, remover porque é redundante
        if (array_value.includes(key)) obj.dependentRequired[key].splice(obj.dependentRequired[key].indexOf(key), 1)

        for (let i = 0; i < array_value.length; i++)
          if (!props.includes(array_value[i])) return error(`A propriedade '${array_value[i]}' definida como obrigatória na presença da propriedade '${key}', na chave 'dependentRequired', é inválida porque não foi definida na chave 'properties'!`)
      }
    }
    return true
  }

  // verificar as condições if then else
  function checkIfThenElse(obj) {
    if (hasAny(["if","then","else"], obj)) {
      if (!hasAll("if", obj)) return error("Não pode usar as chaves 'then' e/ou 'else' numa schema sem usar a chave 'if'!")
    }
    return true
  }

  // verificar que as chaves de tipo numérico são todas coerentes e gerar o modelo da DSL para gerar um valor correspondente
  function dslNumericTypes(obj, type) {
    let {multipleOf, minimum, maximum, exclusiveMinimum, exclusiveMaximum} = obj

    let frac = multipleOf % 1 != 0
    let max = null, min = null
    let upper = null, lower = null

    if (maximum !== undefined) max = maximum
    if (exclusiveMaximum !== undefined) max = exclusiveMaximum - (frac ? 0.0000000001 : 1)

    if (minimum !== undefined) min = minimum
    if (exclusiveMinimum !== undefined) min = exclusiveMaximum + (frac ? 0.0000000001 : 1)

    if (max !== null && min !== null) {
      upper = Math.floor(max/multipleOf)
      lower = Math.ceil(min/multipleOf)
      if (upper - lower < 0) return error(`Não existem múltiplos do número '${multipleOf}' no intervalo de valores especificado com as chaves de alcance!`)
    }
    else if (max !== null) {
      upper = Math.floor(max/multipleOf)
      lower = upper - 100
    }
    else if (min !== null) {
      lower = Math.ceil(min/multipleOf)
      upper = lower + 100
    }

    if (!Object.keys(obj).length) obj.dsl = `'{{${type == "integer" ? "integer" : "float"}(-1000,1000)}}'`
    else if (upper === null) obj.dsl = `'{{multipleOf(${multipleOf})}}'`
    else obj.dsl = `gen => { return gen.integer(${lower}, ${upper}) * ${multipleOf} }`

    return true
  }
}

// ----- Dialect -----

Dialect = ws value:schema_object ws {return value}

begin_array     = ws "[" ws
begin_object    = ws "{" ws {depth++}
end_array       = ws "]" ws
end_object      = ws "}" ws {depth--}
name_separator  = ws ":" ws
value_separator = ws "," ws

ws "whitespace" = [ \t\n\r]*

value = boolean / null / object / array / number / string
boolean = false / true

false = "false" { return false; }
null  = "null"  { return null;  }
true  = "true"  { return true;  }


// ----- Keywords -----

keyword = generic_keyword / string_keyword / number_keyword / object_keyword / array_keyword / 
          media_keyword / schemaComposition_keyword / conditionalSubschemas_keyword / structuring_keyword

// ---------- Keywords generic ----------

generic_keyword = kw_type / kw_enum / kw_const / annotation_keyword

kw_type = QM key:"type" QM name_separator value:type_value {return {key, value}}
type_value = t:type {return [t]} / arr:type_array {return arr}
type = QM v:$("string" / "number" / "integer" / "object" / "array" / "boolean" / "null") QM {return v}

kw_enum = QM key:"enum" QM name_separator value:array {return {key, value}}
kw_const = QM key:"const" QM name_separator value:value {return {key, value}}

// ---------- Keywords annotation ----------

annotation_keyword = kws_annotation_stringValues / kw_default / kw_examples / kws_annotation_booleanValues

kws_annotation_stringValues = QM key:$("title"/"description"/"$comment") QM name_separator value:string {return {key, value}}
kw_default = QM key:"default" QM name_separator value:value {return {key, value}}
kw_examples = QM key:"examples" QM name_separator value:array {return {key, value}}
kws_annotation_booleanValues = QM key:$("readOnly"/"writeOnly"/"deprecated") QM name_separator value:boolean {return {key, value}}

// ---------- Keywords string ----------

string_keyword = kws_string_length / kw_pattern / kw_format

kws_string_length = QM key:$("minLength"/"maxLength") QM name_separator value:int {return {key, value}}
kw_pattern = QM key:"pattern" QM name_separator value:string {return {key, value}}

kw_format = QM key:"format" QM name_separator value:format_value {return {key, value}}
format_value = QM f:("date-time" / "time" / "date" / "duration" / "email" / "idn-email" / "hostname" / "idn-hostname" / "ipv4" / "ipv6"
               / "uuid" / "uri-reference" / "uri-template" / "uri" / "iri-reference" / "iri" / "json-pointer" / "relative-json-pointer" / "regex") QM {return f}

// ---------- Keywords number ----------

number_keyword = kw_multipleOf / kws_range

kw_multipleOf = QM key:"multipleOf" QM name_separator value:positiveNumber {return {key, value}}
kws_range = QM key:$("minimum"/"exclusiveMinimum"/"maximum"/"exclusiveMaximum") QM name_separator value:number {return {key, value}}

// ---------- Keywords object ----------

object_keyword = kws_props / kw_moreProps / kw_requiredProps / kw_propertyNames / kws_size

kws_props = QM key:$("patternProperties"/"properties") QM name_separator value:object_schemaMap {return {key, value}}
kw_moreProps = QM key:$("additionalProperties"/"unevaluatedProperties") QM name_separator value:schema_object {return {key, value}}
kw_requiredProps = QM key:"required" QM name_separator value:string_array {return {key, value}}
kw_propertyNames = QM key:"propertyNames" QM name_separator value:schema_object &{return checkPropertyNamesType(value)} {return {key, value: typeof value == "boolean" ? {type: {def: true, string: {}}} : value}}
kws_size = QM key:$("minProperties"/"maxProperties") QM name_separator value:int {return {key, value}}

// ---------- Keywords array ----------

array_keyword = kw_items / kw_prefixItems / kw_unevaluatedItems / kw_contains / kws_mContains / kws_array_length

kw_items = QM key:"items" QM name_separator value:schema_object {return {key, value}}
kw_prefixItems = QM key:"prefixItems" QM name_separator value:schema_array {return {key, value}}
kw_unevaluatedItems = QM key:"unevaluatedItems" QM name_separator value:schema_object {return {key, value}}
kw_contains = QM key:"contains" QM name_separator value:schema_object {return {key, value}}
kws_mContains = QM key:$("minContains"/"maxContains") QM name_separator value:int {return {key, value}}
kws_array_length = QM key:$("minItems"/"maxItems") QM name_separator value:int {return {key, value}}
kw_uniqueness = QM key:"uniqueItems" QM name_separator value:boolean {return {key, value}}

// ---------- Keywords media ----------

media_keyword = kw_contentMediaType / kw_contentEncoding / kw_contentSchema

kw_contentMediaType = QM key:"contentMediaType" QM name_separator value:mime_type {return {key, value}}
mime_type = ""

kw_contentEncoding = QM key:"contentEncoding" QM name_separator value:encoding {return {key, value}}
encoding = QM e:$("7bit" / "8bit" / "binary" / "quoted-printable" / "base16" / "base32" / "base64") QM {return e}

kw_contentSchema = QM key:"contentSchema" QM name_separator value:schema_object {return {key, value}}

// ---------- Keywords schema composition ----------

schemaComposition_keyword = kws_combineSchemas / kw_notSchema

kws_combineSchemas = QM key:$("allOf"/"anyOf"/"oneOf") QM name_separator value:schema_array {return {key, value}}
kw_notSchema = QM key:"not" QM name_separator value:schema_object {return {key, value}}

// ---------- Keywords conditional subschemas ----------

conditionalSubschemas_keyword = kw_dependentRequired / kw_dependentSchemas / kw_ifThenElse

kw_dependentRequired = QM key:"dependentRequired" QM name_separator value:object_arrayOfStringsMap {return {key, value}}
kw_dependentSchemas = QM key:"dependentSchemas" QM name_separator value:object_schemaMap {return {key, value}}
kw_ifThenElse = QM key:("if"/"then"/"else") QM name_separator value:schema_object {return {key, value}}

// ---------- Keywords structuring ----------

structuring_keyword = kw_schema / kw_id / kw_anchor / kw_ref / kw_defs

kw_schema = QM key:"$schema" QM name_separator value:schema_value &{return atRoot(key)} {return {key, value}}
schema_value = QM v:$("http://json-schema.org/draft-0"[467]"/schema#" / "https://json-schema.org/draft/20"("19-09"/"20-12")"/schema") QM {return v}

kw_id = QM key:"$id" QM name_separator value:string &{return atRoot(key) && newId(value)} {ids.push(value); return {key, value}}
kw_anchor = QM key:"$anchor" QM name_separator value:anchor {return {key, value}}
kw_ref = QM key:"$ref" QM name_separator value:string {return {key, value}}
kw_defs = QM key:$("$defs" {$defs = true}) QM name_separator value:object_schemaMap {$defs = false; return {key, value}}


// ----- Objetos -----

schema_object
  = boolean /
    begin_object members:(
      head:keyword tail:(value_separator m:keyword { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.key] = el.value});
        return result;
    })? end_object
    &{ return checkSchema(members) }
    { members = structureSchemaData(members); return validateSchemaData(members) }

object
  = begin_object members:(
      head:member tail:(value_separator m:member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

member /* "object member" */
  = name:string name_separator value:value {return {name, value}}

object_schemaMap
  = begin_object members:(
      head:schema_member tail:(value_separator m:schema_member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

schema_member /* "object member with a schema value" */
  = name:string name_separator value:schema_object {return {name, value}}

object_arrayOfStringsMap
  = begin_object members:(
      head:arrayOfStrings_member tail:(value_separator m:arrayOfStrings_member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

arrayOfStrings_member /* "object member with a string array value" */
  = name:string name_separator value:string_array {return {name, value}}


// ----- Arrays -----

array "array"
  = begin_array values:(
      head:value tail:(value_separator v:value { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

string_array "array of strings"
  = begin_array values:(
      head:string tail:(value_separator v:string { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

schema_array "array of schemas"
  = begin_array values:(
      head:schema_object tail:(value_separator v:schema_object { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

type_array "array of JSON types"
  = begin_array values:(
      head:type tail:(value_separator v:type { return v; })*
    { return tail.includes(head) ? error("Os elementos do array 'type' devem ser todos únicos!") : [head].concat(tail); }
    )? end_array
    { return values !== null ? values : error("O array de tipos não pode ser vazio!"); }


// ----- Números -----

number "number" = "-"? int frac? { return parseFloat(text()); }
positiveNumber "positive number" = int frac? { return parseFloat(text()); }

exp = [eE] ("-"/"+")? [0-9]+
frac = "." [0-9]+

int "integer" 
  = integer:(("0"* i:([1-9] [0-9]*) {return i}) / (i:"0" "0"* {return i})) {return parseInt(Array.isArray(integer) ? integer.flat().join("") : integer)}


// ----- Strings -----

string "string" = QM chars:char* QM {return chars.join("")}
anchor "anchor" = QM value:$([a-zA-Z][a-zA-Z0-9\-\_\:\.]*) QM {return value}

char
  = unescaped
  / escape
    sequence:(
        '"'
      / "\\"
      / "/"
      / "b" { return "\b"; }
      / "f" { return "\f"; }
      / "n" { return "\n"; }
      / "r" { return "\r"; }
      / "t" { return "\t"; }
      / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
          return String.fromCharCode(parseInt(digits, 16));
        }
    )
    { return sequence; }

escape = "\\"
QM = '"'

unescaped = [^\0-\x1F\x22\x5C]
HEXDIG = [0-9a-f]i
