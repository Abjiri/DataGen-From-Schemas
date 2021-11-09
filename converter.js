// nr de elementos que vão ser criados como objetos temporariamente na DSL com uma chave especial 
// e convertidos posteriormente para a forma original na tradução JSON-XML do DataGen
let temp_structs = 0

// tabs de indentação
let indent = depth => "\t".repeat(depth)

function XSD2DSL(content, prefix) {
   let str = "<!LANGUAGE pt>\n{\n"
   let depth = 1

   let elements = content.filter(x => x.element == "element")
   for (let i = 0; i < elements.length; i++) {
      let {elem_str, _} = parseElement(elements[i], prefix, depth, null)

      if (elem_str.length > 0) {
         str += indent(depth) + elem_str
         if (i < elements.length-1) str += ","
         str += "\n"
      }
   }

   str += "}"
   return str
}

function parseElement(el, prefix, depth, keys) {
   // schemaElem indica se é o <element> é uma coleção ou não
   let elem_str = "", schemaElem = keys === null
   // se for aninhado, numerar as suas ocorrências para não dar overwrite na geração do DataGen
   let name = () => `${schemaElem ? "" : `DFS_${keys[el.attrs.name]++}__`}${el.attrs.name}: ` 
   let occurs = schemaElem ? 1 : randomize(el.attrs.minOccurs, el.attrs.maxOccurs)

   for (let i = 0; i < occurs; i++) {
      // converte o valor do elemento para string DSL
      let parsed = parseElementAux(el, prefix, depth)

      // completa a string DSL com a chave e formatação
      if (parsed.length > 0) elem_str += name() + parsed + (i < occurs-1 ? `,\n${indent(depth)}` : "")
   }

   return {elem_str, occurs, keys}
}

function parseElementAux(el, prefix, depth) {
   let attrs = el.attrs

   // parsing dos atributos -----
   /* if ("abstract" in attrs) */
   if ("nillable" in attrs) {
      // se "nillable" for true, dar uma probabilidade de 30% de o conteúdo do elemento no XML ser nil
      if (attrs.nillable && Math.random() < 0.3) return "{ nil: true }"
   }
   if ("fixed" in attrs) return attrs.fixed
   if ("default" in attrs) return attrs.default
   if ("type" in attrs) return `'${typeToString(parseType(attrs.type, prefix))}'`

   // parsing do conteúdo -----
   let type = el.content.shift()
   if (type.element == "simpleType") return `${parseSimpleType(type, prefix, depth+1)}` // a parte relevante do simpleType é o elemento filho (list / restriction / union)
   else return parseComplexType(type, prefix, depth)
}

function parseNumberType(c, base, has) {
   // verificar se o tipo base é um tipo de números inteiros
   let intBase = () => !["decimal","double","float"].includes(base)

   if (has("enumeration")) return `'{{random(${c.enumeration.join(",")})}}'`
   //if (has("pattern"))

   let min = null, max = null
   
   // número máximo de casas decimais - se frac == total == 1, os números não poderão ter casas decimais
   let frac = has("fractionDigits") ? c.fractionDigits : 0
   if (has("totalDigits") && c.totalDigits == 1) frac = 0

   if (has("maxInclusive")) max = c.maxInclusive
   if (has("minInclusive")) min = c.minInclusive
   if (has("maxExclusive")) max = c.maxExclusive - (intBase() ? 1 : 0.1)
   if (has("minExclusive")) min = c.minExclusive + (intBase() ? 1 : 0.1)

   if (has("totalDigits")) {
      let maxPerTD = parseInt('9'.repeat(c.totalDigits)), minPerTD = -maxPerTD

      if (max === null || maxPerTD < max) max = maxPerTD
      if (min === null || minPerTD > min) min = minPerTD
   }
   
   // se a este ponto ainda não tiver ambos valores de max e min, atribuir valores default
   if (max === null && min === null) {max = 99999; min = -99999}
   else if (max === null) max = min + 100000
   else if (min === null) min = max - 100000

   if (!frac) return `'{{${["double","float"].includes(base) ? "float" : "integer"}(${min}, ${max})}}'`
   return `'{{float(${min}, ${max}, ${frac})}}'`
}

function parseDateTimeType(c, base, has) {
   if ("enumeration" in c) return `'{{random("${c.enumeration.join('","')}")}}'`
   //if (has("pattern")) ...

   let min = null, max = null
   
   if (["date","dateTime"].includes(base)) {
      // função para ir buscar a data do dia anterior ou seguinte
      let adjustDate = (str, offset) => {
         let date = new Date(str)
         
         if (offset != 0) {
            // se for uma date, o offset é em dias
            if (base == "date") date = new Date(parseInt(date.setDate(date.getDate() + offset)))
            // caso contrário, é em segundos
            else date = new Date(parseInt(date.getTime() + offset*1000))
         }

         date = date.toISOString().split("T")
         date[1] = date[1].slice(0,-5)

         date[0] = date[0].split("-")
         date[0] = `${date[0][2]}-${date[0][1]}-${date[0][0]}`

         return date
      }

      // se for exclusivo, é preciso ajustar a data
      if (has("maxInclusive")) max = adjustDate(c.maxInclusive, 0)
      if (has("minInclusive")) min = adjustDate(c.minInclusive, 0)
      if (has("maxExclusive")) max = adjustDate(c.maxExclusive, -1)
      if (has("minExclusive")) min = adjustDate(c.minExclusive, 1)

      return `'{{date("${min[0]}", "${max[0]}"${base == "date" ? ', "YYYY-MM-DD"' : ""})}}'`
   }
}

function parseSimpleType(st, prefix) {
   /* if (child.element == "list") {
      let value = "itemType" in child.attrs ? typeToString(parseType(child.attrs.itemType, prefix)) : parseSimpleType(child.content[0].content[0], prefix)
      
      let list_len = randomize(3,10)
      return `${value} `.repeat(list_len).slice(0,-1)
   }

   if (child.element == "union") {
      let values = []
      if ("memberTypes" in child.attrs) values = child.attrs.memberTypes.map(x => typeToString(parseType(x, prefix)))
      child.content.forEach(x => values.push(parseSimpleType(x.content[0], prefix)))
      
      return values[randomize(0,values.length-1)]
   } */

   // verificar se a faceta em questão existe no conteúdo
   let has = facet => facet in st.content
   
   switch (st.built_in_base) {
      case "anyURI": case "base64Binary": case "ENTITY": case "ENTITIES": case "hexBinary": case "ID": case "IDREFS": case "IDREF": case "language": 
      case "Name": case "NCName": case "NMTOKEN": case "NMTOKENS": case "normalizedString": case "NOTATION": case "QName": case "string": case "token":
         facets = ["enumeration","length","maxLength","minLength","pattern"]; 

         if ("enumeration" in st.content) return `'{{random("${st.content.enumeration.join('","')}")}}'`
         // ("pattern" in st.content) ...
         break

      case "boolean": facets = ["pattern"]; break

      case "byte": case "decimal": case "double": case "float": case "int": case "integer": case "long": case "negativeInteger": case "nonNegativeInteger":
      case "nonPositiveInteger": case "positiveInteger": case "short": case "unsignedByte": case "unsignedInt": case "unsignedLong": case "unsignedShort":
         return parseNumberType(st.content, st.built_in_base, has)

      case "date": case "dateTime": case "duration": case "gDay": case "gMonth": case "gMonthDay": case "gYear": case "gYearMonth": case "time":
         return parseDateTimeType(st.content, st.built_in_base, has)
   }
}

function parseComplexType(el, prefix, depth) {
   let parsed = {attrs: "", content: ""}

   parsed.attrs = parseAttributeGroup(el, prefix, depth+1)

   for (let i = 0; i < el.content.length; i++) {
      switch (el.content[i].element) {
         case "group": parsed.content = parseGroup(el.content[i], prefix, depth+1, {}).str.slice(0, -2); break;
         case "all": parsed.content = parseAll(el.content[i], prefix, depth+2, {}).str; break;
         case "sequence": parsed.content = parseSequence(el.content[i], prefix, depth+1, {}).str.slice(0, -1); break;
         case "choice": parsed.content = parseChoice(el.content[i], prefix, depth+1, {}).str; break;
      }
   }
   
   if (!parsed.attrs.length && !parsed.content.length) return "{ missing(100) {empty: true} }"

   let str = "{\n"
   if (parsed.attrs.length > 0) str += parsed.attrs + ",\n"
   return str + `${parsed.content}\n${indent(depth)}}`
}

const chooseQM = str => str.includes('"') ? "'" : '"'

function parseAttribute(el, prefix, depth) {
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

   if ("type" in attrs) value = `'${typeToString(parseType(attrs.type, prefix))}'.string()`

   return indent(depth) + str + value
}

function parseAttributeGroup(el, prefix, depth) {
   let str = ""

   for (let i = 0; i < el.content.length; i++) {
      let parsed = ""

      switch (el.content[i].element) {
         case "attribute": parsed = parseAttribute(el.content[i], prefix, depth); break;
         case "attributeGroup": parsed = parseAttributeGroup(el.content[i], prefix, depth); break;
      }
      
      if (parsed.length > 0) str += parsed + ",\n"
   }

   return str.slice(0, -2)
}

function parseGroup(el, prefix, depth, keys) {
   let str = ""

   // repetir os filhos um nr aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      let parsed

      switch (el.content[0].element) {
         case "all":
            parsed = parseAll(el.content[0], prefix, depth+2, keys)
            
            if (parsed.str.length > 0) {
               // ajustar a formatação e remover o \n no fim para meter uma vírgula antes
               parsed.str = parsed.str.replace(/\n\t+/g, "\n" + "\t".repeat(depth+2)).replace(/\t+}/, "\t".repeat(depth+1) + "}")
               parsed.str = `${indent(depth)}DFS_TEMP__${++temp_structs}: {\n${parsed.str}\n${indent(depth)}},`
            }
            break;
         case "choice": parsed = parseChoice(el.content[0], prefix, depth, keys); parsed.str += ","; break;
         case "sequence": parsed = parseSequence(el.content[0], prefix, depth, keys); break;
      }

      if (parsed.str.length > 0) str += parsed.str + "\n"
      keys = parsed.keys
   }

   return {str, keys}
}

function parseAll(el, prefix, depth, keys) {
   let elements = el.content.filter(x => x.element == "element")
   let elements_str = [], nr_elems = 0

   elements.forEach(x => {
      // se ainda não tiver sido gerado nenhum destes elementos, colocar a sua chave no mapa
      if (!(x.attrs.name in keys)) keys[x.attrs.name] = 1

      // dar parse a cada elemento
      let parsed = parseElement(x, prefix, depth, keys)

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

function parseSequence(el, prefix, depth, keys) {
   let str = ""

   // repetir os filhos um nr aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      let parsed = parseCT_child_content(el.element, str, el.content, prefix, depth, keys)

      str = parsed.str
      keys = parsed.keys
   }

   return {str: str.slice(0, -1), keys}
}

function parseChoice(el, prefix, depth, keys) {
   let str = ""

   // escolher um dos filhos um nº aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      // usar a primitiva or para fazer exclusividade mútua
      str += `${indent(depth++)}or() {\n`

      let parsed = parseCT_child_content(el.element, str, el.content, prefix, depth, keys)
      keys = parsed.keys

      str = parsed.str.slice(0, -2) + `\n${indent(--depth)}},\n`
   }

   return {str: str.slice(0, -2), keys}
}

function parseCT_child_content(parent, str, content, prefix, depth, keys) {
   // a var choice é para indicar se o último elemento filtrado foi uma choice
   let choice

   content.forEach(x => {
      let parsed
      choice = false

      // na string de um <element>, é preciso por tabs e vírgula
      if (x.element == "element") {
         // se ainda não tiver sido gerado nenhum destes elementos, colocar a sua chave no mapa
         if (!(x.attrs.name in keys)) keys[x.attrs.name] = 1

         parsed = parseElement(x, prefix, depth, keys)
         if (parsed.elem_str.length > 0) str += `${indent(depth)}${parsed.elem_str},\n`
      }

      if (x.element == "group") {
         parsed = parseGroup(x, prefix, depth, keys)
         if (parsed.str.length > 0) str += parsed.str
      }

      // a string de uma <sequence> já vem formatada
      if (x.element == "sequence") {
         parsed = parseSequence(x, prefix, depth, keys)

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
         parsed = parseChoice(x, prefix, depth, keys)
         if (parsed.str.length > 0) str += parsed.str + ",\n"
         choice = true
      }

      keys = parsed.keys
   })

   return {str, choice, keys}
}

let num_types = ["float","double","decimal","integer","nonPositiveInteger","nonNegativeInteger","negativeInteger","positiveInteger","long","int","short","byte","unsignedLong","unsignedInt","unsignedShort","unsignedByte"]
let datetime_types = ["dateTime","date","time","gDay","gMonth","gYear","gYearMonth","gMonthDay","duration"]
let string_types = ["string","normalizedString","token"]
let bin_types = ["hexBinary","base64Binary"]
let built_in_types = [...num_types, ...datetime_types, ...string_types, ...bin_types, "boolean"]

function parseTypeName(type, prefix) {
   if (type.includes(':')) {
      let split = type.split(':')

      if (split[0] == prefix) {
         type = split[1] // remover o prefixo do nome do tipo

         if (!built_in_types.includes(type)) {return "local_schema"} // é um tipo local da schema
         return type
      }
      else {return "other_schema"} // é um tipo de outra schema
   }
}

function parseType(type, prefix) {
   let dsl
   type = parseTypeName(type, prefix)

   // numéricos
   if (type == "float") dsl = [Math.random() < 0.5 ? "-" : "", {moustache: "float", args: ["0.0000000000000000000000000000000000000118", "340000000000000000000000000000000000000"]}]
   if (type == "double") dsl = [Math.random() < 0.5 ? "-" : "", {moustache: "float", args: ["0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000223", "18000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"]}]
   if (type == "decimal") dsl = [{moustache: "float", args: ["-999999999999999999999999999999.999", "999999999999999999999999999999.999"]}]
   if (type == "integer") dsl = [{moustache: "integer", args: ["-999999999999999999999999999999", "999999999999999999999999999999"]}]
   if (type == "nonPositiveInteger") dsl = [{moustache: "integer", args: ["-999999999999999999999999999999", "0"]}]
   if (type == "nonNegativeInteger") dsl = [{moustache: "integer", args: ["0", "999999999999999999999999999999"]}]
   if (type == "negativeInteger") dsl = [{moustache: "integer", args: ["-999999999999999999999999999999", "-1"]}]
   if (type == "positiveInteger") dsl = [{moustache: "integer", args: ["1", "999999999999999999999999999999"]}]
   if (type == "long") dsl = [{moustache: "integer", args: ["-9223372036854775808", "9223372036854775807"]}]
   if (type == "int") dsl = [{moustache: "integer", args: ["-2147483648", "2147483647"]}]
   if (type == "short") dsl = [{moustache: "integer", args: ["-32768", "32767"]}]
   if (type == "byte") dsl = [{moustache: "integer", args: ["-128", "127"]}]
   if (type == "unsignedLong") dsl = [{moustache: "integer", args: ["0", "18446744073709551615"]}]
   if (type == "unsignedInt") dsl = [{moustache: "integer", args: ["0", "4294967295"]}]
   if (type == "unsignedShort") dsl = [{moustache: "integer", args: ["0", "65535"]}]
   if (type == "unsignedByte") dsl = [{moustache: "integer", args: ["0", "255"]}]

   // data/hora
   if (type == "dateTime") dsl = [{moustache: "date", args: ['"01-01-1950"']}]
   if (type == "date") dsl = [{moustache: "date", args: ['"01-01-1950"', '"YYYY-MM-DD"']}]
   if (type == "time") dsl = [{moustache: "time", args: ['"hh:mm:ss"', "24", false]}]
   if (type == "gDay") dsl = ["---", {moustache: "integer", args: ["1", "31"]}]
   if (type == "gMonth") dsl = ["--", {moustache: "integer", args: ["1", "12"]}]
   if (type == "gYear") dsl = [{moustache: "integer", args: ["1950", "2010"]}]
   if (type == "gYearMonth") dsl = [{moustache: "integer", args: ["1950", "2010"]}, "-", {moustache: "integer", args: ["1", "12"]}]
   if (type == "gMonthDay") dsl = ["--", {moustache: "integer", args: ["1", "12"]}, "-", {moustache: "integer", args: ["1", "31"]}]
   if (type == "duration") dsl = ["P", {moustache: "integer", args: ["1950", "2010"]}, "Y", {moustache: "integer", args: ["1", "12"]}, "M", {moustache: "integer", args: ["1", "31"]}, "DT", {moustache: "integer", args: ["0", "23"]}, "H", {moustache: "integer", args: ["0", "59"]}, "M", {moustache: "integer", args: ["0", "59"]}, "S"]

   // string
   if (type == "string") dsl = [{moustache: "lorem", args: ['"words"', "3", "10"]}]
   if (type == "normalizedString") dsl = normalizedString(randomize(10,50))
   if (type == "token") dsl = normalizedString(randomize(30,50)).trim().replace(/ +/g," ")

   // binários
   if (type == "hexBinary") dsl = hexBinary(randomize(10,50))
   if (type == "base64Binary") dsl = [btoa(randomString(randomize(10,50)))]

   // boolean
   if (type == "boolean") dsl = [{moustache: "boolean", args: []}]

   if (type == "ID") dsl = [{moustache: "guid", args: []}]

   return dsl
}

const typeToString = arr => arr.reduce((accum, curr) => accum += (typeof curr == "string" ? curr : `{{${curr.moustache}(${curr.args.join(",")})}}`), "")



// funções auxiliares ----------
function randomize(min, max) { return Math.floor(Math.random() * ((max+1) - min) + min) }

function randomString(alphabet, length) {
   let optLength = alphabet.length

   let result = []
   for (let i = 0; i < length; i++) result.push(alphabet[Math.floor(Math.random() * optLength)])
   return result
}

function normalizedString(length) {
   let options = [{moustache: "letter", args: []}, " ", {moustache: "integerOfSize", args: ["1"]}]
   return randomString(options, length)
}

function hexBinary(length) {
   let fstDigit = {moustache: "integer", args: ["2", "7"]}

   let hexChars = [[fstDigit, {moustache: "integerOfSize", args: ["1"]}]] // 20-79
   hexChars = hexChars.concat(["a","b","c","d","e"].map(c => [fstDigit, c])) // [2-7][a-f]
   hexChars.push([{moustache: "integer", args: ["2", "6"]}, "f"]) // [2-6]f

   return randomString(hexChars, length).flat()
}

const btoa = str => Buffer.from(str, 'binary').toString('base64')



// TESTE

let content = [
   {
      "element": "element",
      "attrs": {
         "name": "aaaa",
         "abstract": false,
         "nillable": false
      },
      "content": [
         {
            "element": "simpleType",
            "attrs": {},
            "built_in_base": "dateTime",
            "content": {
               "whiteSpace": "collapse",
               "maxExclusive": "1999-01-01T12:12:12",
               "minExclusive": "1111-01-01T23:59:59"
            }
         }
      ]
   }
]

console.log(XSD2DSL(content, "xs"))