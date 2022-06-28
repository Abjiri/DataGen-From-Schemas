const {parseSimpleType} = require('./simpleType')

let default_prefix = null
let xsd_content = []
let simpleTypes = {}
let complexTypes = {}
let recursiv = {element: {}, complexType: {}, group: {}}
let SETTINGS = {}
let ids = 0

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

function normalizeName(name, end_prefix, prefixed) {
   let prefix = "DFXS_"

   if (/\.|\-/.test(name)) {
      prefix += "NORMALIZED_"
      name = name.replace(/\./g, "__DOT__").replace(/\-/g, "__HYPHEN__")
   }

   return ((!prefixed && prefix == "DFXS_") ? "" : (prefix + end_prefix)) + name + ": "
}

function convert(xsd, st, ct, main_elem, user_settings) {
   let depth = 1
   let str = `<!LANGUAGE pt>\n{\n${indent(depth)}DFXS__FROM_XML_SCHEMA: true,\n`
   
   // variáveis globais
   default_prefix = xsd.prefix
   xsd_content = xsd.content
   simpleTypes = st
   complexTypes = ct
   SETTINGS = user_settings
   ids = 0
   temp_structs = 0

   let elements = xsd.content.filter(x => x.element == "element")
   if (!elements.length) str += indent(depth) + "DFXS_EMPTY_XML: true\n"
   else {
      let parsed = parseElement(elements.find(x => x.attrs.name == main_elem), depth, {}, true)
      if (parsed.elem_str.length > 0) str += indent(depth) + parsed.elem_str + "\n"
   }

   str += "}"
   str = str.replace(/{XSD_IDREF}/g, `id{{integer(1,${ids})}}`)
   return str
}

// schemaElem indica se é o <element> é uma coleção ou não
function parseElement(el, depth, keys, schemaElem) {
    if ("ref" in el.attrs) return parseRef(el, depth, keys)

    let elem_str = "", name = el.attrs.name
    let minOccurs = null, maxOccurs = null

    // função auxiliar para verificar se o elemento referencia um tipo complexo
    let complexTypeRef = attrs => "type" in attrs && xsd_content.some(x => x.element == "complexType" && x.attrs.name == attrs.type)

    // se ainda não tiver sido gerado nenhum destes elementos, colocar a sua chave no mapa
    // numerar as suas ocorrências para não dar overwrite na geração do DataGen
    // é desnecessário para elementos de schema, que são únicos, mas é para simplificar
    if (!(name in keys)) keys[name] = 1
    if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded

    if (schemaElem) minOccurs = maxOccurs = 1
    else {
        minOccurs = el.attrs.minOccurs
        maxOccurs = el.attrs.maxOccurs
    }

    // atualizar o mapa de recursividade deste elemento
    if (name in recursiv.element) recursiv.element[name]++
    else recursiv.element[name] = 1

    // se o elemento tiver um tipo complexo por referência
    if (complexTypeRef(el.attrs)) {
        if (el.attrs.type in recursiv.complexType) recursiv.complexType[el.attrs.type]++
        else recursiv.complexType[el.attrs.type] = 1

        if (recursiv.complexType[el.attrs.type] > SETTINGS.recursivity.upper) minOccurs = 0
    }
   
    let repeat = !(minOccurs == 1 && maxOccurs == 1)
    let normName = normalizeName(name, "ELEM__", false)
    let parsed = parseElementAux(el, depth)

    if (repeat) elem_str += `DFXS_FLATTEN__${++temp_structs}: [ 'repeat(${minOccurs}${minOccurs==maxOccurs ? "" : `,${maxOccurs}`})': {\n${indent(depth+1)}`

    if (!("ref" in el.attrs)) elem_str += !parsed.length ? "{ DFXS_EMPTY_XML: true }" : (normName + parsed)
    else {
        elem_str += parsed.elem_str
        keys = parsed.keys
    }

    if (repeat) elem_str += `\n${indent(depth)}} ]`

    recursiv.element[name]--
    if (complexTypeRef(el.attrs)) recursiv.complexType[el.attrs.type]--
    
    return {elem_str, occurs: maxOccurs, keys}
}

function parseElementAux(el, depth) {
   let attrs = el.attrs

   // parsing dos atributos -----
   /* if ("abstract" in attrs) */
   if ("nillable" in attrs) {
      // se "nillable" for true, dar uma probabilidade de 30% de o conteúdo do elemento no XML ser nil
      if (attrs.nillable && Math.random() < 0.3) return "{ DFXS_ATTR__nil: true }"
   }
   if ("fixed" in attrs) return '"' + attrs.fixed + '"'
   if ("default" in attrs && Math.random() > 0.4) return '"' + attrs.default + '"'
   if ("type" in attrs) return parseType(attrs.type, depth)

   // parsing do conteúdo -----
   let type = el.content[0]
   if (type.element == "simpleType") {
      let parsed = parseSimpleType(type, ids, depth) // a parte relevante do simpleType é o elemento filho (list / restriction / union)
      ids = parsed.ids
      return parsed.str
   }
   else return parseComplexType(type, depth)
}

function parseRef(el, depth, keys) {
   let ref_el = xsd_content.filter(x => x.element == el.element && x.attrs.name == el.attrs.ref)[0]

   ref_el.attrs = {...ref_el.attrs, ...el.attrs}
   delete ref_el.attrs.ref

   switch (el.element) {
      case "element": return parseElement(ref_el, depth, keys, false)
      case "group": return parseGroup(ref_el, depth, keys)
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
         case "group": parsed.content += parseGroup(content[i], depth+1, {}).str; break;
         case "all": parsed.content += parseAll(content[i], depth+2, {}).str; break;
         case "sequence": parsed.content += parseSequence(content[i], depth+1, {}).str; break;
         case "choice": parsed.content += parseChoice(content[i], depth+1, {}).str; break;
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

function parseGroup(el, depth, keys) {
   if ("ref" in el.attrs) return parseRef(el, depth, keys)
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded

   let str = "", parsed, min = el.attrs.minOccurs, max = el.attrs.maxOccurs
   let repeat = min!=1 || max!=1, base_depth = depth + (repeat ? 1 : 0)
   
   switch (el.content[0].element) {
      case "all":
         parsed = parseAll(el.content[0], base_depth+2, keys)
         
         if (parsed.str.length > 0) {
            parsed.str = parsed.str.replace(/\n\t+/g, "\n" + indent(base_depth+2)).replace(/\t+}/, indent(base_depth+1) + "}") // ajustar a formatação
            parsed.str = `${indent(base_depth)}DFXS_TEMP__${++temp_structs}: {\n${parsed.str}\n${indent(base_depth)}}`
         }
         break;
      case "choice": parsed = parseChoice(el.content[0], base_depth, keys); break;
      case "sequence": parsed = parseSequence(el.content[0], base_depth-1, keys); break;
   }
   if (parsed.str.length > 0) str = parsed.str

   if (repeat) str = `${indent(depth)}DFXS_FLATTEN__${++temp_structs}: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${str}\n${indent(depth)}} ]`
   return {str, keys}
}

function parseAll(el, depth, keys) {
   let elements = el.content.filter(x => x.element == "element")
   let elements_str = [], nr_elems = 0, min = el.attrs.minOccurs

   elements.forEach(x => {
      // dar parse a cada elemento
      let parsed = parseElement(x, depth+1, keys, false)

      if (parsed.elem_str.length > 0) {
         // contar o nr de elementos total (tendo em conta max/minOccurs de cada um)
         nr_elems += parsed.occurs
         keys = parsed.keys

         // dar parse a todos os elementos e guardar as respetivas strings num array
         elements_str.push(`\n${indent(depth+1)}${parsed.elem_str},`)
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
   return {str, keys}
}

function parseSequence(el, depth, keys) {
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded
   
   let min = el.attrs.minOccurs, max = el.attrs.maxOccurs
   let repeat = min!=1 || max!=1, base_depth = depth + (repeat ? 1 : 0)

   let str = parseCT_child_content(el.element, "", el.content, base_depth, keys).slice(0, -2)
   if (repeat) str = `${indent(depth)}DFXS_FLATTEN__${++temp_structs}: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${str}\n${indent(depth)}} ]`

   return {str, keys}
}

function parseChoice(el, depth, keys) {
   if (el.attrs.maxOccurs == "unbounded") el.attrs.maxOccurs = SETTINGS.unbounded

   let min = el.attrs.minOccurs, max = el.attrs.maxOccurs
   let repeat = min!=1 || max!=1, base_depth = depth + (repeat ? 1 : 0)

   // usar a primitiva or para fazer exclusividade mútua
   let str = parseCT_child_content(el.element, `${indent(base_depth)}or() {\n`, el.content, base_depth+1, keys).slice(0, -2) + `\n${indent(base_depth)}}`
   if (repeat) str = `${indent(depth)}DFXS_FLATTEN__${++temp_structs}: [ 'repeat(${min}${min==max ? "" : `,${max}`})': {\n${str}\n${indent(depth)}} ]`

   return {str, keys}
}

function parseCT_child_content(parent, str, content, depth, keys) {
   content.forEach(x => {
      let parsed

      // na string de um <element>, é preciso por indentação
      if (x.element == "element") {
         parsed = parseElement(x, depth, keys, false)
         if (parsed.elem_str.length > 0) str += `${indent(depth)}${parsed.elem_str},\n`
      }

      if (x.element == "group") {
         parsed = parseGroup(x, depth, keys)
         if (parsed.str.length > 0) str += parsed.str + ",\n"
      }

      // a string de uma <sequence> já vem formatada
      if (x.element == "sequence") {
         parsed = parseSequence(x, depth, keys)

         if (parsed.str.length > 0) {
            if (parent == "choice") {
               // para uma sequence dentro de uma choice, queremos escolher a sequência inteira e não apenas um dos seus elementos
               // por isso, cria-se um objeto na DSL com uma chave especial que posteriormente é removido na tradução para XML
               parsed.str = "\t" + parsed.str.replace(/\n\t/g, "\n\t\t")
               str += `${indent(depth)}DFXS_TEMP__${++temp_structs}: {\n${parsed.str}\n${indent(depth)}},\n`
            }
            else str += parsed.str + ",\n"
         }
      }

      // a string de uma <choice> já vem formatada
      if (x.element == "choice") {
         parsed = parseChoice(x, depth, keys)
         if (parsed.str.length > 0) str += parsed.str + ",\n"
      }

      if (x.element == "all") {
         parsed = parseAll(x, depth, keys)
         if (parsed.str.length > 0) str += parsed.str + ",\n"
      }
   })

   return str
}


module.exports = { convert }