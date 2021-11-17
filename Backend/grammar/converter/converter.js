const {parseSimpleType} = require('./simpleType')
const {parseComplexType} = require('./complexType')

let default_prefix = null
let simpleTypes = {}

// Tabs de indentação
const indent = depth => "\t".repeat(depth)
// Gerar um número aleatório entre min e max (inclusivé)
const randomize = (min, max) => Math.floor(Math.random() * ((max+1) - min) + min)

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

   if (type.includes(':')) {
     let split = type.split(':')
     type = split[1] // remover o prefixo do nome do tipo
     prefix = split[0]
   }
   // tipo embutido ou local desta schema
   else prefix = default_prefix

   // é um tipo da schema local, logo se não for embutido, é possível encontrar a sua base embutida na estrutura simpleTypes
   if (prefix == default_prefix) base = builtin_types.includes(type) ? type : simpleTypes[type].built_in_base

   return {type, base, prefix}
}


function convertXSD(xsd, st) {
   let str = "<!LANGUAGE pt>\n{\n"
   let depth = 1

   // variáveis globais
   default_prefix = xsd.prefix
   simpleTypes = st

   let elements = xsd.content.filter(x => x.element == "element")
   for (let i = 0; i < elements.length; i++) {
      let {elem_str, _} = parseElement(elements[i], depth, null)

      if (elem_str.length > 0) {
         str += indent(depth) + elem_str
         if (i < elements.length-1) str += ","
         str += "\n"
      }
   }

   str += "}"
   return str
}

function parseElement(el, depth, keys) {
   // schemaElem indica se é o <element> é uma coleção ou não
   let elem_str = "", schemaElem = keys === null
   // se for aninhado, numerar as suas ocorrências para não dar overwrite na geração do DataGen
   let name = () => `${schemaElem ? "" : `DFS_${keys[el.attrs.name]++}__`}${el.attrs.name}: ` 
   let occurs = schemaElem ? 1 : randomize(el.attrs.minOccurs, el.attrs.maxOccurs)

   for (let i = 0; i < occurs; i++) {
      // converte o valor do elemento para string DSL
      let parsed = parseElementAux(el, depth)

      // completa a string DSL com a chave e formatação
      if (parsed.length > 0) elem_str += name() + parsed + (i < occurs-1 ? `,\n${indent(depth)}` : "")
   }

   return {elem_str, occurs, keys}
}

function parseElementAux(el, depth) {
   let attrs = el.attrs

   // parsing dos atributos -----
   /* if ("abstract" in attrs) */
   if ("nillable" in attrs) {
      // se "nillable" for true, dar uma probabilidade de 30% de o conteúdo do elemento no XML ser nil
      if (attrs.nillable && Math.random() < 0.3) return "{ DFS_ATTR__nil: true }"
   }
   if ("fixed" in attrs) return attrs.fixed
   if ("default" in attrs) return attrs.default
   if ("type" in attrs) return parseType(attrs.type)

   // parsing do conteúdo -----
   let type = el.content.shift()
   if (type.element == "simpleType") return `${parseSimpleType(type)}` // a parte relevante do simpleType é o elemento filho (list / restriction / union)
   else return parseComplexType(type, depth)
}

function parseType(type) {
   type = getTypeInfo(type)
   let st = simpleTypes[type.type]

   if (!("built_in_base" in st)) st.built_in_base = type.base
   return parseSimpleType(st)
}


module.exports = { convertXSD }