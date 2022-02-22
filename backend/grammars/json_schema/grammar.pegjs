// Gramática de JSON Schema para "DataGen from Schemas" -----

{
  let depth = 0
  let genericKeys = ["type","$schema"]

  const atRoot = kw => depth==1 ? true : error(`A chave '${kw}' só é permitida ao nível da raiz!`)

  // verificar que não se usam chaves específicas a tipos nos tipos errados
  function checkKeysByType(members) {
    if (members === null) return true
    if (!("type" in members)) return error("Especifique o tipo deste valor através da chave 'type'!")

    let keywords = genericKeys
    for (let i = 0; i < members.type.length; i++) {
      switch (members.type[i]) {
        case "string": keywords = keywords.concat(["minLength","maxLength","pattern","format"]); break
        case "integer":
        case "number": keywords = keywords.concat(["multipleOf","minimum","exclusiveMinimum","maximum","exclusiveMaximum"]); break
        case "object": keywords = keywords.concat(["properties","patternProperties","additionalProperties","unevaluatedProperties"]); break
      }
    }

    for (let k in members)
      if (!keywords.includes(k)) return error(`O tipo '${members.type}' não suporta a chave '${k}'!`)
    return true
  }

  // verificar a coerência das chaves de alcance de tipos númericos
  function checkRangeKeywords(members) {
    if (members === null) return true

    let min = null, max = null, emin = null, emax = null
    let has = key => key in members

    if (has("minimum")) min = members.minimum
    if (has("maximum")) max = members.maximum
    if (has("exclusiveMinimum")) emin = members.exclusiveMinimum
    if (has("exclusiveMaximum")) emax = members.exclusiveMaximum

    if (min !== null && max !== null && min > max) return error(`O valor da chave 'minimum' deve ser <= ao da chave 'maximum'!`)
    if (min !== null && emax !== null && min >= emax) return error(`O valor da chave 'minimum' deve ser < ao da chave 'exclusiveMaximum'!`)
    if (max !== null && emin !== null && max <= emin) return error(`O valor da chave 'maximum' deve ser > ao da chave 'exclusiveMinimum'!`)

    if (min !== null && emin !== null) {
      if (emin >= min) delete members.minimum
      else delete members.exclusiveMinimum
    }
    if (max !== null && emax !== null) {
      if (emax <= max) delete members.maximum
      else delete members.exclusiveMaximum
    }

    return members
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


// ----- Valores -----

value = false / true / null / object / array / number / string

false = "false" { return false; }
null  = "null"  { return null;  }
true  = "true"  { return true;  }


// ----- Keywords -----

keyword = kw_type / kw_schema / string_keywords / number_keywords / object_keywords

kw_type = QM key:"type" QM name_separator value:type_value {return {key, value}}
type_value = t:type {return [t]} / arr:type_array {return arr}
type = QM v:$("string" / "number" / "integer" / "object" / "array" / "boolean" / "null") QM {return v}

kw_schema = QM key:"$schema" QM name_separator value:schema_value &{return atRoot(key)} {return {key, value}}
schema_value = QM v:$("http://json-schema.org/draft-0"[467]"/schema#" / "https://json-schema.org/draft/20"("19-09"/"20-12")"/schema") QM {return v}

// ---------- Keywords string ----------

string_keywords = kws_length / kw_pattern / kw_format

kws_length = QM key:$(("min"/"max")"Length") QM name_separator value:int {return {key, value}}
kw_pattern = QM key:"pattern" QM name_separator value:string {return {key, value}}

kw_format = QM key:"format" QM name_separator value:format_value {return {key, value}}
format_value = QM f:("date-time" / "time" / "date" / "duration" / "email" / "idn-email" / "hostname" / "idn-hostname" / "ipv4" 
              / "ipv6" / "uuid" / "uri" / "uri-reference" / "iri" / "iri-reference" / "uri-template" / "json-pointer" / "regex") QM {return f}

// ---------- Keywords number ----------

number_keywords = kw_multipleOf / kws_range

kw_multipleOf = QM key:"multipleOf" QM name_separator value:positiveNumber {return {key, value}}
kws_range = QM key:$(("exclusive"?("Min"/"Max")"imum")/("min"/"max")"imum") QM name_separator value:positiveNumber {return {key, value}}

// ---------- Keywords object ----------

object_keywords = kw_properties / kw_patternProperties / kw_moreProperties

kw_properties = QM key:"properties" QM name_separator value:object {return {key, value}}
kw_patternProperties = QM key:"patternProperties" QM name_separator value:object_schemaMap {return {key, value}}
kw_moreProperties = QM key:$(("additional"/"unevaluated")"Properties") QM name_separator value:schema_object {return {key, value}}


// ----- Objetos -----

schema_object
  = true / false /
    begin_object members:(
      head:keyword tail:(value_separator m:keyword { return m; })* {
        var result = {};
        [head].concat(tail).forEach(el => {result[el.key] = el.value});
        return result;
    })? end_object
    &{ return checkKeysByType(members) && checkRangeKeywords(members) }
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
  = begin_array
    values:(
      head:value
      tail:(value_separator v:value { return v; })*
      { return [head].concat(tail); }
    )?
    end_array
    { return values !== null ? values : []; }

type_array
  = begin_array
    values:(
      head:type
      tail:(value_separator v:type { return v; })*
      { return tail.includes(head) ? error("Os elementos do array 'type' devem ser todos únicos!") : [head].concat(tail); }
    )?
    end_array
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
