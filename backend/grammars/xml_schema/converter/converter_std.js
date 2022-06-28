const {parseSimpleType} = require('./simpleType')

let default_prefix = null
let xsd_content = []
let simpleTypes = {}
let complexTypes = {}
let SETTINGS = {}
let ids = 0

// Tabs de indentação
const indent = depth => "\t".repeat(depth)
// Escolher uma QM que não seja usada na própria string
const chooseQM = str => str.includes('"') ? "'" : '"'

// criar array com os nomes do tipos embutidos da XML Schema
const built_in_types = () => {
   let types = []
   for (let p in simpleTypes) if (!("built_in_base" in simpleTypes[p])) types.push(p)
   return types
}

// determinar o nome e prefixo de schema do tipo em questão e o nome da sua base embutida
/* operacional apenas para tipos da schema local */
function getTypeInfo(type) {
   let builtin_types = built_in_types()
   let base = null // nome do tipo embutido em questão ou em qual é baseado o tipo atual
   let prefix = null
   let complex = false

   if (type.includes(':')) {
     let split = type.split(':')
     type = split[1] // remover o prefixo do nome do tipo
     prefix = split[0]
   }
   // tipo embutido ou local desta schema
   else prefix = default_prefix

   // é um tipo da schema local, logo se não for embutido, é possível encontrar a sua base embutida na estrutura simpleTypes
   if (prefix == default_prefix) {
      if (Object.keys(complexTypes).includes(type)) complex = true
      else base = builtin_types.includes(type) ? type : simpleTypes[type].built_in_base
   }

   return {type, complex, base, prefix}
}

function normalizeName(name, end_prefix, prefixed) {
   let prefix = "DFXS_"

   if (/\.|\-/.test(name)) {
      prefix += "NORMALIZED_"
      name = name.replace(/\./g, "__DOT__").replace(/\-/g, "__HYPHEN__")
   }

   return ((!prefixed && prefix == "DFXS_") ? "" : (prefix + end_prefix)) + name + ": "
}

function convert(xsd, st, ct, main_elem, user_settings) {
   let depth = 1, temp_structs = 1
   let str = `<!LANGUAGE pt>\n{\n${indent(depth)}DFXS__FROM_XML_SCHEMA: true,\n`
   
   // variáveis globais
   default_prefix = xsd.prefix
   xsd_content = xsd.content
   simpleTypes = st
   complexTypes = ct
   SETTINGS = user_settings
   ids = 0

   let elements = xsd.content.filter(x => x.element == "element")
   if (!elements.length) str += indent(depth) + "DFXS_EMPTY_XML: true\n"
   else {
      let parsed = parseElement(elements.find(x => x.attrs.name == main_elem), depth, true)
      if (parsed.length > 0) str += indent(depth) + parsed + "\n"
   }

   str += "}"
   str = str.replace(/DFXS_(TEMP|FLATTEN)__/g, (m) => m + temp_structs++)
   str = str.replace(/{XSD_IDREF}/g, `id{{integer(1,${ids})}}`)
   return str
}

// schemaElem indica se é o <element> é uma coleção ou não
function parseElement(el, depth, schemaElem) {
   if ("ref" in el.attrs) return parseRef(el, depth)
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded

   let str = "", parsed = parseElementAux(el, depth), min = null, max = null
   if (schemaElem) min = max = 1
   else {
      min = el.attrs.minOccurs
      max = el.attrs.maxOccurs
   }

   if (!("ref" in el.attrs)) str = !parsed.length ? "{ DFXS_EMPTY_XML: true }" : (normalizeName(el.attrs.name, "ELEM__", false) + parsed)
   else str = parsed.str

   if (min!=1 || max!=1) str = `DFXS_FLATTEN__: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${indent(depth+1)}${str}\n${indent(depth)}} ]`   
   return str
}

function parseElementAux(el, depth) {
   // parsing dos atributos -----
   /* if ("abstract" in attrs) */
   if ("nillable" in el.attrs) {
      // se "nillable" for true, dar uma probabilidade de 30% de o conteúdo do elemento no XML ser nil
      if (el.attrs.nillable && Math.random() < 0.3) return "{ DFXS_ATTR__nil: true }"
   }
   if ("fixed" in el.attrs) return '"' + el.attrs.fixed + '"'
   if ("default" in el.attrs && Math.random() > 0.4) return '"' + el.attrs.default + '"'
   if ("type" in el.attrs) return parseType(el.attrs.type, depth)

   // parsing do conteúdo -----
   let type = el.content[0]
   if (type.element == "simpleType") {
      let parsed = parseSimpleType(type, ids, depth) // a parte relevante do simpleType é o elemento filho (list / restriction / union)
      ids = parsed.ids
      return parsed.str
   }
   else return parseComplexType(type, depth)
}

function parseRef(el, depth) {
   let ref_el = xsd_content.find(x => x.element == el.element && x.attrs.name == el.attrs.ref)

   ref_el.attrs = {...ref_el.attrs, ...el.attrs}
   delete ref_el.attrs.ref

   switch (el.element) {
      case "element": return parseElement(ref_el, depth, false)
      case "group": return parseGroup(ref_el, depth)
   }
}

function parseType(type, depth) {
   type = getTypeInfo(type)

   if (!type.complex) {
      let st = JSON.parse(JSON.stringify(simpleTypes[type.type]))
      if (!["built_in_base","list","union"].some(x => x in st)) st.built_in_base = type.base

      let parsed = parseSimpleType(st, ids, depth)
      ids = parsed.ids
      return parsed.str
   }
   return parseComplexType(complexTypes[type.type], depth)
}


// Funções de tradução de complexTypes ----------

function parseComplexType(el, depth) {
   let parsed = {attrs: "", content: ""}
   parsed.attrs = parseAttributeGroup(el, depth+1)

   let content = el.content.filter(x => !x.element.includes("ttribute"))
   let content_len = content.length

   for (let i = 0; i < content_len; i++) {
      switch (content[i].element) {
         case "simpleContent": return parseExtensionSC(content[i].content[0], depth)
         case "group": parsed.content += parseGroup(content[i], depth+1); break;
         case "all": parsed.content += parseAll(content[i], depth+2); break;
         case "sequence": parsed.content += parseSequence(content[i], depth+1); break;
         case "choice": parsed.content += parseChoice(content[i], depth+1); break;
      }

      if (i < content_len - 1) parsed.content += ",\n"
   }

   let str = "{\n"
   let empty = !parsed.attrs.length && !parsed.content.length

   if ("mixed" in el.attrs && el.attrs.mixed) {
      if (!("mixed_type" in el)) str += `${indent(depth+1)}DFXS_MIXED_DEFAULT: true${empty ? "" : ",\n"}`
      else {
         let base_st = el.mixed_type.content[0]
         let mixed_content = parseSimpleType({built_in_base: base_st.built_in_base, content: base_st.content}, ids, depth)
         
         ids = mixed_content.ids
         str += `${indent(depth+1)}DFXS_MIXED_RESTRICTED: ${mixed_content.str}${empty ? "" : ",\n"}`
      }
   }
   else if (empty) return "{ missing(100) {empty: true} }"

   if (parsed.attrs.length > 0) {
      str += parsed.attrs
      if (parsed.content.length > 0) str += ",\n"
   }
   return str + `${parsed.content}\n${indent(depth)}}`
}

function parseAttribute(el, depth) {
   let attrs = el.attrs
   let str = normalizeName(attrs.name, "ATTR__", true), value = ""

   // parsing dos atributos
   if (attrs.use == "prohibited") return ""
   if ("fixed" in attrs) value = attrs.fixed
   if ("default" in attrs && Math.random() > 0.4) value = attrs.default

   // se tiver um valor predefinido, verifica se tem "/' dentro para encapsular com o outro
   if (value.length > 0) {
      let qm = chooseQM(value)
      return indent(depth) + str + qm + value + qm
   }

   if ("type" in attrs) value = parseType(attrs.type, depth)
   else {
      value = parseSimpleType(el.content[0], ids, depth)
      ids = value.ids
      value = value.str
   }

   return indent(depth) + str + value
}

function parseAttributeGroup(el, depth) {
   let str = ""

   for (let i = 0; i < el.content.length; i++) {
      let parsed = ""

      switch (el.content[i].element) {
         case "attribute": parsed = parseAttribute(el.content[i], depth); break;
         case "attributeGroup": parsed = parseAttributeGroup(el.content[i], depth); break;
      }
      
      if (parsed.length > 0) str += parsed + ",\n"
   }

   return str.slice(0, -2)
}

function parseExtensionSC(el, depth) {
   let parsed = {attrs: "", content: ""}

   parsed.attrs = parseAttributeGroup(el, depth+1)
   parsed.content = parseType(el.attrs.base, depth+1)

   let str = "{\n"
   if (parsed.attrs.length > 0) {
      str += parsed.attrs
      if (parsed.content.length > 0) str += ",\n"
   }

   if (parsed.content.length > 0) str += indent(depth+1)
   return `${str}DFXS_SIMPLE_CONTENT: ${parsed.content}\n${indent(depth)}}`
}

function parseGroup(el, depth) {
   if ("ref" in el.attrs) return parseRef(el, depth)
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded

   let str = "", parsed, min = el.attrs.minOccurs, max = el.attrs.maxOccurs
   let repeat = min!=1 || max!=1, base_depth = depth + (repeat ? 1 : 0)
   
   switch (el.content[0].element) {
      case "all":
         parsed = parseAll(el.content[0], base_depth+2)
         
         if (parsed.length > 0) {
            parsed = parsed.replace(/\n\t+/g, "\n" + indent(base_depth+2)).replace(/\t+}/, indent(base_depth+1) + "}") // ajustar a formatação
            parsed = `${indent(base_depth)}DFXS_TEMP__: {\n${parsed}\n${indent(base_depth)}}`
         }
         break;
      case "choice": parsed = parseChoice(el.content[0], base_depth); break;
      case "sequence": parsed = parseSequence(el.content[0], base_depth-1); break;
   }
   if (parsed.length > 0) str = parsed

   if (repeat) str = `${indent(depth)}DFXS_FLATTEN__: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${str}\n${indent(depth)}} ]`
   return str
}

function parseAll(el, depth) {
   let elements = el.content.filter(x => x.element == "element")
   let elements_str = [], nr_elems = 0, min = el.attrs.minOccurs

   elements.forEach(x => {
      let parsed = parseElement(x, depth+1, false) // dar parse a cada elemento

      if (parsed.str.length > 0) {
         nr_elems += x.attrs.maxOccurs // contar o nr de elementos total (tendo em conta maxOccurs de cada um)
         elements_str.push(`\n${indent(depth+1)}${parsed.str},`) // dar parse a todos os elementos e guardar as respetivas strings num array
      }
   })

   let str = "", base_depth = depth - (!min ? 0 : 1) 
   if (!min) str = `${indent(depth-1)}if (Math.random() < 0.3) { missing(100) {empty: true} }\n${indent(depth-1)}else {\n`

   // usar a primitiva at_least para randomizar a ordem dos elementos
   str += `${indent(base_depth)}at_least(${nr_elems}) {`
   if (elements_str.length > 0) str += elements_str.join("").slice(0, -1)
   else str += `\n${indent(base_depth+1)}empty: true` // se o conteúdo for vazio, colocar uma propriedade filler para usar o missing(100)
   str += `\n${indent(base_depth)}}`

   if (!min) str += `\n${indent(base_depth-1)}}`
   return str
}

function parseSequence(el, depth) {
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded
   
   let min = el.attrs.minOccurs, max = el.attrs.maxOccurs
   let repeat = min!=1 || max!=1, base_depth = depth + (repeat ? 1 : 0)

   let str = parseCT_child_content(el.element, "", el.content, base_depth).slice(0, -2)
   console.log(str)
   if (repeat) str = `${indent(depth)}DFXS_FLATTEN__: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${str}\n${indent(depth)}} ]`

   return str
}

function parseChoice(el, depth) {
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded

   let min = el.attrs.minOccurs, max = el.attrs.maxOccurs
   let repeat = min!=1 || max!=1, base_depth = depth + (repeat ? 1 : 0)

   // usar a primitiva or para fazer exclusividade mútua
   let str = parseCT_child_content(el.element, `${indent(base_depth)}or() {\n`, el.content, base_depth+1).slice(0, -2) + `\n${indent(base_depth)}}`
   if (repeat) str = `${indent(depth)}DFXS_FLATTEN__: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${str}\n${indent(depth)}} ]`

   return str
}

function parseCT_child_content(parent, str, content, depth) {
   content.forEach(x => {
      let parsed

      // na string de um <element>, é preciso por indentação
      if (x.element == "element") {
         parsed = parseElement(x, depth, false)
         if (parsed.length > 0) str += `${indent(depth)}${parsed},\n`
      }

      if (x.element == "group") {
         parsed = parseGroup(x, depth)
         if (parsed.length > 0) str += parsed + ",\n"
      }

      if (x.element == "sequence") {
         parsed = parseSequence(x, depth)

         if (parsed.length > 0) {
            if (parent == "choice") {
               // para uma sequence dentro de uma choice, queremos escolher a sequência inteira e não apenas um dos seus elementos
               // por isso, cria-se um objeto na DSL com uma chave especial que posteriormente é removido na tradução para XML
               parsed = "\t" + parsed.replace(/\n\t/g, "\n\t\t")
               str += `${indent(depth)}DFXS_TEMP__: {\n${parsed}\n${indent(depth)}},\n`
            }
            else str += parsed + ",\n"
         }
      }

      if (x.element == "choice") {
         parsed = parseChoice(x, depth)
         if (parsed.length > 0) str += parsed + ",\n"
      }

      if (x.element == "all") {
         parsed = parseAll(x, depth)
         if (parsed.length > 0) str += parsed + ",\n"
      }
   })

   return str
}


module.exports = { convert }