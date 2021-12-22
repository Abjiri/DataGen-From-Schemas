const {parseSimpleType} = require('./simpleType')

let default_prefix = null
let simpleTypes = {}
let complexTypes = {}
let unbounded = 0

/* nr de elementos que vão ser criados como objetos temporariamente na DSL com uma chave especial 
e convertidos posteriormente para a forma original na tradução JSON-XML do DataGen */
let temp_structs = 0

// Tabs de indentação
const indent = depth => "\t".repeat(depth)
// Escolher uma QM que não seja usada na própria string
const chooseQM = str => str.includes('"') ? "'" : '"'
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


function convertXSD(xsd, st, ct, unbounded_value) {
   let str = "<!LANGUAGE pt>\n{\n"
   let depth = 1
   unbounded = unbounded_value
   
   // variáveis globais
   default_prefix = xsd.prefix
   simpleTypes = st
   complexTypes = ct

   for (let i = 0; i < xsd.content.length; i++) {
      let {elem_str, _} = parseElement(xsd.content[i], depth, {}, true)

      if (elem_str.length > 0) {
         str += indent(depth) + elem_str
         if (i < xsd.content.length-1) str += ","
         str += "\n"
      }
   }

   if (!xsd.content.length) str += indent(depth) + "DFS_EMPTY_XML: true\n"

   str += "}"
   return str
}

// schemaElem indica se é o <element> é uma coleção ou não
function parseElement(el, depth, keys, schemaElem) {
   let elem_str = ""

   // se ainda não tiver sido gerado nenhum destes elementos, colocar a sua chave no mapa
   if (!(el.attrs.name in keys)) keys[el.attrs.name] = 1

   // numerar as suas ocorrências para não dar overwrite na geração do DataGen
   // é desnecessário para elementos de schema, que são únicos, mas é para simplificar
   let name = () => {
      let name = el.attrs.name
      let prefix = "DFS_"

      if (/\.|\-/.test(name)) {
         prefix += "NORMALIZED_"
         name = name.replace(/\./g, "__DOT__").replace(/\-/g, "__HYPHEN__")
      }
      
      return `${prefix}${keys[el.attrs.name]++}__${name}: `
   }

   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = unbounded
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
   if ("fixed" in attrs) return '"' + attrs.fixed + '"'
   if ("default" in attrs) return '"' + attrs.default + '"'
   if ("type" in attrs) return parseType(attrs.type, depth)

   // parsing do conteúdo -----
   let type = el.content[0]
   if (type.element == "simpleType") return `${parseSimpleType(type)}` // a parte relevante do simpleType é o elemento filho (list / restriction / union)
   else return parseComplexType(type, depth)
}

function parseType(type, depth) {
   type = getTypeInfo(type)

   if (!type.complex) {
      let st = simpleTypes[type.type]
   
      if (!["built_in_base","list","union"].some(x => x in st)) st.built_in_base = type.base
      return parseSimpleType(st)
   }
   return parseComplexType(complexTypes[type.type], depth)
}


// Funções de tradução de complexTypes ----------

function parseComplexType(el, depth) {
   let parsed = {attrs: "", content: ""}
   parsed.attrs = parseAttributeGroup(el, depth+1)

   el.content = el.content.filter(x => !x.element.includes("ttribute"))
   let content_len = el.content.length

   for (let i = 0; i < content_len; i++) {
      switch (el.content[i].element) {
         case "simpleContent": return parseSimpleContent(el.content[i], depth+1);
         case "group": parsed.content += parseGroup(el.content[i], depth+1, {}).str.slice(0, -2); break;
         case "all": parsed.content += parseAll(el.content[i], depth+2, {}).str; break;
         case "sequence": parsed.content += parseSequence(el.content[i], depth+1, {}).str.slice(0, -1); break;
         case "choice": parsed.content += parseChoice(el.content[i], depth+1, {}).str; break;
      }

      if (i < content_len - 1) parsed.content += ",\n"
   }

   if (!parsed.attrs.length && !parsed.content.length) return "{ missing(100) {empty: true} }"

   let str = "{\n"
   if (parsed.attrs.length > 0) {
      str += parsed.attrs
      if (parsed.content.length > 0) str += ",\n"
   }
   return str + `${parsed.content}\n${indent(depth)}}`
}

function parseAttribute(el, depth) {
   let attrs = el.attrs
   let str = `DFS_ATTR__${attrs.name}: `, value = ""

   // parsing dos atributos -----
   if (attrs.use == "prohibited") return ""
   if ("fixed" in attrs) value = attrs.fixed
   if ("default" in attrs) value = attrs.default

   // se tiver um valor predefinido, verifica se tem "/' dentro para encapsular com o outro
   if (value.length > 0) {
      let qm = chooseQM(value)
      return indent(depth) + str + qm + value + qm
   }

   if ("type" in attrs) value = parseType(attrs.type)
   else value = parseSimpleType(el.content[0])

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

function parseSimpleContent(el, depth) {
   if (el.content[0].element == "extension") return parseExtensionSC(el.content[0], depth)
}

function parseExtensionSC(el, depth) {
   let parsed = {attrs: "", content: ""}

   parsed.attrs = parseAttributeGroup(el, depth)
   parsed.content = parseType(el.attrs.base)

   let str = "{\n"
   if (parsed.attrs.length > 0) {
      str += parsed.attrs
      if (parsed.content.length > 0) str += ",\n" + indent(depth)
   }
   return str + `DFS_EXTENSION__SC: ${parsed.content}\n${indent(depth-1)}}`
}

function parseGroup(el, depth, keys) {
   let str = ""
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = unbounded

   // repetir os filhos um nr aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      let parsed

      switch (el.content[0].element) {
         case "all":
            parsed = parseAll(el.content[0], depth+2, keys)
            
            if (parsed.str.length > 0) {
               // ajustar a formatação e remover o \n no fim para meter uma vírgula antes
               parsed.str = parsed.str.replace(/\n\t+/g, "\n" + "\t".repeat(depth+2)).replace(/\t+}/, "\t".repeat(depth+1) + "}")
               parsed.str = `${indent(depth)}DFS_TEMP__${++temp_structs}: {\n${parsed.str}\n${indent(depth)}},`
            }
            break;
         case "choice": parsed = parseChoice(el.content[0], depth, keys); parsed.str += ","; break;
         case "sequence": parsed = parseSequence(el.content[0], depth, keys); break;
      }

      if (parsed.str.length > 0) str += parsed.str + "\n"
      keys = parsed.keys
   }
   
   return {str, keys}
}

function parseAll(el, depth, keys) {
   let elements = el.content.filter(x => x.element == "element")
   let elements_str = [], nr_elems = 0

   elements.forEach(x => {
      // se ainda não tiver sido gerado nenhum destes elementos, colocar a sua chave no mapa
      if (!(x.attrs.name in keys)) keys[x.attrs.name] = 1

      // dar parse a cada elemento
      let parsed = parseElement(x, depth, keys, false)

      if (parsed.elem_str.length > 0) {
         // contar o nr de elementos total (tendo em conta max/minOccurs de cada um)
         nr_elems += parsed.occurs
         keys = parsed.keys

         // dar parse a todos os elementos e guardar as respetivas strings num array
         elements_str.push(`\n${indent(depth)}${parsed.elem_str},`)
      }
   })

   // usar a primitiva at_least para randomizar a ordem dos elementos
   let str = `${indent(depth-1)}at_least(${nr_elems}) {`
   if (elements_str.length > 0) str += elements_str.join("").slice(0, -1)
   else str += `\n${indent(depth)}empty: true` // se o conteúdo for vazio, colocar uma propriedade filler para usar o missing(100)
   str += `\n${indent(depth-1)}}`

   // se minOccurs = 0, dar uma probabilidade de 30% de o elemento não aparecer no XML
   if (!elements_str.length || !el.attrs.minOccurs && Math.random() < 0.3) str = str.replace(/at_least\(\d+\)/, "missing(100)")

   return {str, keys}
}

function parseSequence(el, depth, keys) {
   let str = ""
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = unbounded

   // repetir os filhos um nr aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      let parsed = parseCT_child_content(el.element, str, el.content, depth, keys)

      str = parsed.str
      keys = parsed.keys
   }

   return {str: str.slice(0, -1), keys}
}

function parseChoice(el, depth, keys) {
   let str = ""
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = unbounded

   // escolher um dos filhos um nº aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      // usar a primitiva or para fazer exclusividade mútua
      str += `${indent(depth++)}or() {\n`

      let parsed = parseCT_child_content(el.element, str, el.content, depth, keys)
      keys = parsed.keys

      str = parsed.str.slice(0, -2) + `\n${indent(--depth)}},\n`
   }

   return {str: str.slice(0, -2), keys}
}

function parseCT_child_content(parent, str, content, depth, keys) {
   // a var choice é para indicar se o último elemento filtrado foi uma choice
   let choice
   
   content.forEach(x => {
      let parsed
      choice = false

      // na string de um <element>, é preciso por tabs e vírgula
      if (x.element == "element") {
         // se ainda não tiver sido gerado nenhum destes elementos, colocar a sua chave no mapa
         if (!(x.attrs.name in keys)) keys[x.attrs.name] = 1

         parsed = parseElement(x, depth, keys, false)
         if (parsed.elem_str.length > 0) str += `${indent(depth)}${parsed.elem_str},\n`
      }

      if (x.element == "group") {
         parsed = parseGroup(x, depth, keys)
         if (parsed.str.length > 0) str += parsed.str
      }

      // a string de uma <sequence> já vem formatada
      if (x.element == "sequence") {
         parsed = parseSequence(x, depth, keys)

         if (parsed.str.length > 0) {
            if (parent == "choice") {
               // para uma sequence dentro de uma choice, queremos escolher a sequência inteira e não apenas um dos seus elementos
               // por isso, cria-se um objeto na DSL com uma chave especial que posteriormente é removido na tradução para XML
               parsed.str = "\t" + parsed.str.replace(/\n\t/g, "\n\t\t").slice(0, -1)
               str += `${indent(depth)}DFS_TEMP__${++temp_structs}: {\n${parsed.str}\n${indent(depth)}},\n`
            }
            else str += parsed.str + "\n"
         }
      }

      // a string de uma <choice> já vem formatada
      if (x.element == "choice") {
         parsed = parseChoice(x, depth, keys)
         if (parsed.str.length > 0) str += parsed.str + ",\n"
         choice = true
      }

      if (x.element == "all") {
         parsed = parseAll(x, depth, keys)
         if (parsed.str.length > 0) str += parsed.str + ",\n"
      }

      keys = parsed.keys
   })

   return {str, choice, keys}
}


module.exports = { convertXSD }