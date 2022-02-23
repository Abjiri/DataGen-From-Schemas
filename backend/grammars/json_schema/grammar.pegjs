// Gramática de JSON Schema para "DataGen from Schemas" -----

{
  let depth = 0
  let propertyNames = false

  let genericKeywords = ["type","$schema","enum"]
  let stringKeywords = ["minLength","maxLength","pattern","format"]
  let numericKeywords = ["multipleOf","minimum","exclusiveMinimum","maximum","exclusiveMaximum"]
  let objectKeywords = ["properties","patternProperties","additionalProperties","unevaluatedProperties","required","propertyNames","minProperties","maxProperties"]
  let arrayKeywords = ["items","prefixItems","contains","minContains","maxContains","minItems","maxItems","uniqueItems"]

  // chave só permitida na raiz
  const atRoot = kw => depth==1 ? true : error(`A chave '${kw}' só é permitida ao nível da raiz!`)
  // verificar se objeto tem a(s) propriedade(s) em questão
  const has = (k, obj) => typeof k == "string" ? k in obj : k.every(key => key in obj)

  // fazer todas as verificações necessárias para garantir que a schema está bem escrita
  function checkSchema(s) {
    if (s === null) return true
    return checkKeysByType(s) && checkRangeKeywords(s) && checkRequiredProps(s) && checkMaxProperties(s) && checkContains(s) && checkArrayLength(s) && checkEnumArray(s)
  }

  // verificar que não se usam chaves específicas a tipos nos tipos errados
  function checkKeysByType(obj) {
    if (propertyNames) { if (!has("type", obj)) obj.type = ["string"] }
    else if (!has("type", obj) && !Object.keys(obj).every(k => genericKeywords.includes(k))) return error("Especifique o tipo deste valor através da chave 'type'!")

    if (has("type", obj)) {
      let keywords = genericKeywords
      for (let i = 0; i < obj.type.length; i++) {
        switch (obj.type[i]) {
          case "string": keywords = keywords.concat(stringKeywords); break
          case "integer": case "number": keywords = keywords.concat(numericKeywords); break
          case "object": keywords = keywords.concat(objectKeywords); break
          case "array": keywords = keywords.concat(arrayKeywords); break
        }
      }

      for (let k in obj)
        if (!keywords.includes(k)) return error(`O tipo '${obj.type}' não suporta a chave '${k}'!`)
    }
    return true
  }

  // verificar a coerência das chaves de alcance de tipos númericos
  function checkRangeKeywords(obj) {
    let min = null, max = null, emin = null, emax = null

    if (has("minimum", obj)) min = obj.minimum
    if (has("maximum", obj)) max = obj.maximum
    if (has("exclusiveMinimum", obj)) emin = obj.exclusiveMinimum
    if (has("exclusiveMaximum", obj)) emax = obj.exclusiveMaximum

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

    return obj
  }

  // verificar a coerência do array de propriedades da chave 'required'
  function checkRequiredProps(obj) {
    if (!has("properties", obj) && has("required", obj)) return error("Não faz sentido usar a chave 'required' sem definir um conjunto de propriedades com a chave 'properties'!")

    if (has(["properties","required"], obj)) {
      if (obj.required.length != [...new Set(obj.required)].length) return error("Todos os elementos do array da chave 'required' devem ser únicos!")
      
      let props = Object.keys(obj.properties)
      for (let i = 0; i < obj.required.length; i++)
        if (!props.includes(obj.required[i])) return error(`A propriedade '${obj.required[i]}' referida na chave 'required' não foi definida no conjunto de propriedades da chave 'properties'!`)
    }
    return true
  }

  // verificar que a schema dada pela chave 'propertyNames' é do tipo string
  function checkPropertyNamesType(obj) {
    if (has("type", obj) && (obj.type.length > 1 || obj.type[0] != "string"))
      return error(`Como as chaves de objetos devem ser sempre strings, está implícito que a schema dada pela chave 'propertyNames' tem sempre { "type": "string" }!`)
    else obj.type = ["string"]

    return obj
  }

  // verificar que as chaves 'required' e 'maxProperties' não se contradizem
  function checkMaxProperties(obj) {
    if (has(["required","maxProperties"], obj))
      if (obj.maxProperties < obj.required.length) return error(`A chave 'maxProperties' define que o objeto deve ter, no máximo, ${obj.maxProperties} propriedades, contudo a chave 'required' define que há ${obj.required.length} propriedades obrigatórias!`)
    return true
  }

  // verificar a coerência das chaves de contenção 
  function checkContains(obj) {
    if (!has("contains", obj)) {
      if (has("minContains", obj) || has("maxContains", obj)) return error("As chaves 'minContains' e 'maxContains' só podem ser usadas em conjunto com a chave 'contains'!")
    }
    else if (has(["minContains","maxContains"], obj) && obj.minContains > obj.maxContains) return error("O valor da chave 'minContains' deve ser <= ao da chave 'maxContains'!")

    return true
  }

  // verificar a coerência das chaves de comprimento de arrays
  function checkArrayLength(obj) {
    if (has(["prefixItems","maxItems"], obj) && obj.maxItems < obj.prefixItems.length)
      return error(`A chave 'maxItems' define que o array deve ter, no máximo, ${obj.maxItems} elementos, contudo a chave 'prefixItems' especifica ${obj.prefixItems.length} elementos obrigatórios!`)

    if (has(["prefixItems","minItems","items"], obj) && obj.items === false && obj.minItems > obj.prefixItems.length)
      return error(`A chave 'minItems' define que o array deve ter, no mínimo, ${obj.minItems} elementos, contudo a chave 'prefixItems' especifica apenas ${obj.prefixItems.length} elementos obrigatórios e a chave 'items' proibe elementos extra para além desses!`)

    if (has(["minItems","maxItems"], obj) && obj.minItems > obj.maxItems) return error("O valor da chave 'minItems' deve ser <= ao da chave 'maxItems'!")
    return true
  }

  // verificar que os elementos do array da chave 'enum' são todos únicos (não funciona para elementos array/objeto) e do tipo correto
  function checkEnumArray(obj) {
    if (has("enum", obj)) {
      if (!obj.enum.length) return error("O array da chave 'enum' deve ter, no mínimo, um elemento!")
      if (obj.enum.length != [...new Set(obj.enum)].length) return error("Todos os elementos do array da chave 'enum' devem ser únicos!")

      if (has("type", obj)) {
        for (let i = 0; i < obj.enum.length; i++) {
          let valid = false

          for (let j = 0; j < obj.type.length; j++) {
            if (obj.type[j] == "array" && Array.isArray(obj.enum[i])) valid = true
            else if (obj.type[j] == "null" && obj.enum[i] === null) valid = true
            else if (obj.type[j] == "integer" && Number.isInteger(obj.enum[i])) valid = true
            else if (typeof obj.enum[i] == obj.type[j]) valid = true
          }

          if (!valid) return error(`Todos os elementos do array da chave 'enum' devem ser do tipo {${obj.type.join(", ")}}, segundo definido pela chave 'type'!`)
        }
      }
    }
    return true
  }
}

// ----- JSON -----

JSON_text = ws value:(schema_object / value) ws { return value; }

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

keyword = generic_keyword / string_keyword / number_keyword / object_keyword / array_keyword

// ---------- Keywords generic ----------

generic_keyword = kw_type / kw_schema / kw_enum

kw_type = QM key:"type" QM name_separator value:type_value {return {key, value}}
type_value = t:type {return [t]} / arr:type_array {return arr}
type = QM v:$("string" / "number" / "integer" / "object" / "array" / "boolean" / "null") QM {return v}

kw_schema = QM key:"$schema" QM name_separator value:schema_value &{return atRoot(key)} {return {key, value}}
schema_value = QM v:$("http://json-schema.org/draft-0"[467]"/schema#" / "https://json-schema.org/draft/20"("19-09"/"20-12")"/schema") QM {return v}

kw_enum = QM key:"enum" QM name_separator value:array {return {key, value}}

// ---------- Keywords string ----------

string_keyword = kws_string_length / kw_pattern / kw_format

kws_string_length = QM key:$(("min"/"max")"Length") QM name_separator value:int {return {key, value}}
kw_pattern = QM key:"pattern" QM name_separator value:string {return {key, value}}

kw_format = QM key:"format" QM name_separator value:format_value {return {key, value}}
format_value = QM f:("date-time" / "time" / "date" / "duration" / "email" / "idn-email" / "hostname" / "idn-hostname" / "ipv4" 
              / "ipv6" / "uuid" / "uri" / "uri-reference" / "iri" / "iri-reference" / "uri-template" / "json-pointer" / "regex") QM {return f}

// ---------- Keywords number ----------

number_keyword = kw_multipleOf / kws_range

kw_multipleOf = QM key:"multipleOf" QM name_separator value:positiveNumber {return {key, value}}
kws_range = QM key:$(("exclusive"?("Min"/"Max")"imum")/("min"/"max")"imum") QM name_separator value:positiveNumber {return {key, value}}

// ---------- Keywords object ----------

object_keyword = kw_props / kw_patternProps / kw_moreProps / kw_requiredProps / kw_propertyNames / kws_size

kw_props = QM key:"properties" QM name_separator value:object {return {key, value}}
kw_patternProps = QM key:"patternProperties" QM name_separator value:object_schemaMap {return {key, value}}
kw_moreProps = QM key:$(("additional"/"unevaluated")"Properties") QM name_separator value:schema_object {return {key, value}}
kw_requiredProps = QM key:"required" QM name_separator value:string_array {return {key, value}}
kw_propertyNames = QM key:$("propertyNames" {propertyNames=true}) QM name_separator value:schema_object &{return checkPropertyNamesType(value)} {propertyNames=false; return {key, value}}
kws_size = QM key:$(("min"/"max")"Properties") QM name_separator value:int {return {key, value}}

// ---------- Keywords array ----------

array_keyword = kw_items / kw_prefixItems / kw_contains / kws_mContains / kws_array_length

kw_items = QM key:"items" QM name_separator value:schema_object {return {key, value}}
kw_prefixItems = QM key:"prefixItems" QM name_separator value:schema_array {return {key, value}}
kw_contains = QM key:"contains" QM name_separator value:schema_object {return {key, value}}
kws_mContains = QM key:$(("min"/"max")"Contains") QM name_separator value:int {return {key, value}}
kws_array_length = QM key:$(("min"/"max")"Items") QM name_separator value:int {return {key, value}}
kw_uniqueness = QM key:"uniqueItems" QM name_separator value:boolean {return {key, value}}


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
    { return members !== null ? members: {}; }

object
  = begin_object members:(
      head:member tail:(value_separator m:member { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

member = name:string name_separator value:value {return {name, value}}

object_schemaMap
  = begin_object members:(
      head:schemaMember tail:(value_separator m:schemaMember { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.name] = el.value});
        return result;
    })? end_object
    { return members !== null ? members: {}; }

schemaMember = name:string name_separator value:schema_object {return {name, value}}


// ----- Arrays -----

array
  = begin_array values:(
      head:value tail:(value_separator v:value { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

string_array
  = begin_array values:(
      head:string tail:(value_separator v:string { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

schema_array
  = begin_array values:(
      head:schema_object tail:(value_separator v:schema_object { return v; })*
    { return [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }

type_array
  = begin_array values:(
      head:type tail:(value_separator v:type { return v; })*
    { return tail.includes(head) ? error("Os elementos do array 'type' devem ser todos únicos!") : [head].concat(tail); }
    )? end_array
    { return values !== null ? values : []; }


// ----- Números -----

number = "-"? int frac? exp? { return parseFloat(text()); }
positiveNumber = int frac? exp? { return parseFloat(text()); }

exp = [eE] ("-"/"+")? [0-9]+
frac = "." [0-9]+

int = integer:(("0"* i:([1-9] [0-9]*) {return i}) / (i:"0" "0"* {return i})) {return parseInt(Array.isArray(integer) ? integer.flat().join("") : integer)}


// ----- Strings -----

string "string"
  = QM chars:char* QM { return chars.join(""); }

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
