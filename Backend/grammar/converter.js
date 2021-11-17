const RandExp = require('randexp');

// nr de elementos que vão ser criados como objetos temporariamente na DSL com uma chave especial 
// e convertidos posteriormente para a forma original na tradução JSON-XML do DataGen
let temp_structs = 0
let default_prefix = null
let simpleTypes = {}

// tabs de indentação
let indent = depth => "\t".repeat(depth)

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
      if (attrs.nillable && Math.random() < 0.3) return "{ nil: true }"
   }
   if ("fixed" in attrs) return attrs.fixed
   if ("default" in attrs) return attrs.default
   if ("type" in attrs) return parseType(attrs.type)

   // parsing do conteúdo -----
   let type = el.content.shift()
   if (type.element == "simpleType") return `${parseSimpleType(type)}` // a parte relevante do simpleType é o elemento filho (list / restriction / union)
   else return parseComplexType(type, depth)
}

function parseStringType(c, base, has) {
   if (has("enumeration")) return `'{{random("${c.enumeration.join('","')}")}}'`
   if (has("pattern")) return '"' + new RandExp(c.pattern).gen() + '"'

   let length = 0
   let isList = () => ["ENTITIES","IDREFS","NMTOKENS"].includes(base)

   if (has("length")) length = c.length
   else {
      let max = null, min = null
      let upper_bound = isList() ? 20 : 50

      if (has("maxLength")) max = c.maxLength
      if (has("minLength")) min = c.minLength

      if (max === null && min == null) {min = 10; max = upper_bound}
      else if (min == null) min = max > 1 ? 1 : 0
      else if (max == null) max = min + upper_bound

      length = randomize(min, max)
   }
   
   if (isList()) {
      let str = "'"
      for (let i = 0; i < length; i++) str += string(base, 5) + " "
      return str.slice(0, -1) + "'"
   }
   return "'" + (base == "hexBinary" ? hexBinary(length) : string(base, length)) + "'"
}

function parseNumberType(c, base, has) {
   // verificar se o tipo base é um tipo de números inteiros
   let intBase = () => !["decimal","double","float"].includes(base)

   if (has("enumeration")) return `'{{random(${c.enumeration.join(",")})}}'`
   if (has("pattern")) return '"' + new RandExp(c.pattern).gen() + '"'

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

function parseSimpleGType(c, base, has) {
   let aux = {
      gDay: x => parseInt(x.substring(3,5)),
      gMonth: x => parseInt(x.substring(2,4)),
      gYear: x => parseInt(x.match(/\-?\d+/))
   }

   let max = null, min = null

   if (has("maxInclusive")) max = aux[base](c.maxInclusive)
   if (has("minInclusive")) min = aux[base](c.minInclusive)
   if (has("maxExclusive")) max = aux[base](c.maxExclusive) - 1
   if (has("minExclusive")) min = aux[base](c.minExclusive) + 1

   if (base != "gYear") {
      if (max === null) max = base == "gDay" ? 31 : 12
      if (min === null) min = 1
   }
   else {
      if (max === null && min === null) {max = 2020; min = 0}
      else if (max == null) max = min + 1000
      else if (min == null) min = max - 1000
   }

   let hyphens = {gDay: 3, gMonth: 2, gYear: 0}
   let pad = base == "gYear" ? 4 : 2
   return `'${"-".repeat(hyphens[base])}{{formattedInteger(${min},${max},${pad},"")}}'`
}

function parseComplexGType(c, base, has) {
   let aux = {
      gMonthDay: (x,offset) => {
         let day = parseInt(x.substring(5,7)), month = parseInt(x.substring(2,4))

         if (offset == -1) {
            if (day > 1) day--
            else {
               month--
               if ([1,3,5,7,8,10].includes(month)) day = 31
               else if ([4,6,9,11].includes(month)) day = 30
               else if (month == 2) day = 28
            }
         }
         else if (offset == 1) {
            if ((day == 29 && month == 2) || (day == 30 && [4,6,9,11].includes(month)) || (day == 31 && [1,3,5,7,8,10].includes(month))) {month++; day = 1}
            else day++
         }

         return {month, day}
      },
      gYearMonth: (x,offset) => {
         let year = parseInt(x.match(/^\-?\d+/))
         let month = parseInt(x.replace(/^\-?\d+\-/, "").match(/^\d+/))

         if (offset == -1) {
            if (month == 1) {year--; month = 12}
            else month--
         }
         else if (offset == 1) {
            if (month == 12) {year++; month = 1}
            else month++
         }

         return {year, month}
      }
   }

   let max = null, min = null

   if (has("maxInclusive")) max = aux[base](c.maxInclusive, 0)
   if (has("minInclusive")) min = aux[base](c.minInclusive, 0)
   if (has("maxExclusive")) max = aux[base](c.maxExclusive, -1)
   if (has("minExclusive")) min = aux[base](c.minExclusive, 1)
   
   if (max === null && min === null) {
      max = base == "gMonthDay" ? {month: 12, day: 31} : {year: 2020, month: 12}
      min = base == "gMonthDay" ? {month: 1, day: 1} : {year: 0, month: 1}
   }
   else if (max == null) max = base == "gMonthDay" ? {month: 12, day: 31} : {year: min.year + 100, month: 12}
   else if (min == null) min = base == "gMonthDay" ? {month: 1, day: 1} : {year: max.year - 100, month: 1}

   return `gen => {
      let base = ${base}, max = ${JSON.stringify(max)}, min = ${JSON.stringify(min)}

      let randomize = (max,min) => Math.floor(Math.random() * ((max+1) - min) + min)
      let left = base == "gMonthDay" ? "month" : "year"
      let right = base == "gMonthDay" ? "day" : "month"

      let right_val, left_val = randomize(max[left], min[left])
      let right_lower_bound = {
        month: x => 12,
        day: x => {
          if ([1,3,5,7,8,10,12].includes(x)) return 31
          if ([4,6,9,11].includes(x)) return 30
          return 29
        }
      }
      
      if (left_val == max[left]) right_val = randomize(max[right], 1)
      else if (left_val == min[left]) right_val = randomize(min[right], right_lower_bound[right](left_val))
      else right_val = randomize(1, right_lower_bound[right](left_val))

      let hyphens = {gMonthDay: 2, gYearMonth: 0}
      let pad = base == "gMonthDay" ? [2,2] : [4,2]
      return "-".repeat(hyphens[base]) + left_val.toString().padStart(pad[0],"0") + "-" + right_val.toString().padStart(pad[1],"0")
   }`
}

function parseDateTimeType(c, base, has) {
   if (has("enumeration")) return `'{{random("${c.enumeration.join('","')}")}}'`
   if (has("pattern")) return '"' + new RandExp(c.pattern).gen() + '"'

   let aux = {
      date: (str, offset) => {
         let neg = str[0] == "-"
         if (neg) str = str.substring(1)

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
         date[0] = `${date[0][2]}/${date[0][1]}/${date[0][0]}`

         return {date, neg}
      },
      time: (t,offset) => {
         t = t.match(/^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d+)?/)
         t.shift()

         let lastIndex = t.length-1
         if (t[lastIndex] === undefined) t.pop()
         else t[lastIndex] = t[lastIndex].substring(1)

         t = t.map(x => parseInt(x))
         t[t.length-1] += offset
         if (t.length == 3) t.push(0)
         
         let ms = t.pop()
         return {time: t.map(x => x.toString().padStart(2,"0")).join(":"), ms}
      },
      duration: (d, offset) => {
         let parts = []
         d = d.substring(1).split("T")
         if (d.length == 1) d.push("")

         let getParts = (chars, str) => {
            for (let i = 0; i < chars.length; i++) {
               if (!str.includes(chars[i])) {
                  parts.push(0)
                  if (chars[i] == "S") parts.push(0)
               }
               else {
                  let split = str.split(chars[i])
                  str = split[1]

                  if (chars[i] == "S") {
                     let s = split[0].split(".")
                     if (s.length == 1) s.push("0")
                     if (!s[0].length) s[0] = "0"
                     s.map(x => parts.push(parseInt(x)))
                  }
                  else parts.push(parseInt(split[0]))
               }
            }
         }
         
         getParts(["Y","M","D"], d[0])
         getParts(["H","M","S"], d[1])

         if (offset == 1) parts[parts.length-1]++
         if (offset == -1) {
            for (let i = parts.length-1; i >= 0; i--) {
               if (parts[i] > 0) {parts[i]--; break}
            }
         }

         return parts
      }
   }

   aux.dateTime = aux.date
   let min = null, max = null

   // se for exclusivo, é preciso ajustar a data
   if (has("maxInclusive")) max = aux[base](c.maxInclusive, 0)
   if (has("minInclusive")) min = aux[base](c.minInclusive, 0)
   if (has("maxExclusive")) max = aux[base](c.maxExclusive, -1)
   if (has("minExclusive")) min = aux[base](c.minExclusive, 1)
   
   if (["date","dateTime"].includes(base)) {
      if (max === null && min === null) min = {date: ["01/01/1950", "00:00:00"], neg: false}
      else if (min === null) {
         let maxDate = max[0].split("/")
         let year = parseInt(maxDate[2])
         min = {date: [`${maxDate[0]}/${maxDate[1]}/${year > 1000 ? (year-1000).toString().padStart(4,"0") : "0000"}`, "00:00:00"], neg: false}
      }

      return `gen => {
         let base = "${base}", max = ${JSON.stringify(max)}, min = ${JSON.stringify(min)}
         
         let time, date = max.date !== null ? gen.date(min.date[0], max.date[0], "YYYY-MM-DD") : gen.date(min.date[0], "YYYY-MM-DD")
         
         if (base == "dateTime") {
            let randomize = (max,min) => Math.floor(Math.random() * ((max+1) - min) + min)
            
            if (date == max.date[0]) time = gen.time("hh:mm:ss", 24, false, max.date[1], "23:59:59")
            else if (date == min.date[0]) time = gen.time("hh:mm:ss", 24, false, "00:00:00", min.date[1])
            else time = gen.time("hh:mm:ss", 24, false)
         }

         if (date > max.date[0] || date < min.date[0]) date = "-" + date
         return date + (base == "dateTime" ? ("T" + time) : "")
      }`
   }

   if (base == "time") {
      if (max === null) max = {time: "23:59:59", ms: "999"}
      if (min === null) min = {time: "00:00:00", ms: "000"}

      let str = `'{{time("hh:mm:ss", 24, false, "${max.time}", "${min.time}")}}`
      if (!max.ms || !min.ms) str += `.{{integer(${max.ms}, ${min.ms})}}`
      return str + "'"
   }

   if (base == "duration") {
      if (max === null && min == null) {max = [1,0,0,0,0,0,0]; min = [0,0,0,0,0,0,0]}
      else if (max === null) {max = min; max[0] += 1}
      else if (min === null) {
         if (max[0] > 0) {min = max; min[0] -= 1}
         else min = [0,0,0,0,0,0,0]
      }
      
      return `gen => {
         let max = ${JSON.stringify(max)}, min = ${JSON.stringify(min)}
         let randomize = (max,min) => Math.floor(Math.random() * ((max+1) - min) + min)

         let str = "P", units = ["Y","M","D","H","M",".","S"], maxPossible = [0, 12, 30, 24, 59, 59, 999]
         let fstEq = false, rand

         for (let i = 0; i < max.length; i++) {
            if (!fstEq) {
               if (max[i] == min[i]) {
                  if (max[i] != 0) str += max[i] + units[i]
                  else if (units[i] == ".") str += units[i]
               }
               else {
                  fstEq = true
                  rand = {new: randomize(max[i], min[i]), inf: min[i], sup: max[i]}
                  if (rand.new != 0) str += rand.new + units[i]
               }
            }
            else {
               if (rand.new == rand.inf) str += randomize(maxPossible[i], min[i]) + units[i]
               else if (rand.new == rand.sup) str += randomize(max[i], 0) + units[i]
               else str += randomize(maxPossible[i], 0) + units[i]
            }
            if (i == 2) str += "T"
         }

         return str
      }`
   }
}

function parseLanguage(c, has) {
   let langs = ["af","ar-ae","ar-bh","ar-dz","ar-eg","ar-iq","ar-jo","ar-kw","ar-lb","ar-ly","ar-ma","ar-om","ar-qa","ar-sa","ar-sy","ar-tn","ar-ye","ar","as","az","be","bg","bn","ca","cs","da","de-at","de-ch","de-li","de-lu","de","div","el","en-au","en-bz","en-ca","en-gb","en-ie","en-jm","en-nz","en-ph","en-tt","en-us","en-za","en-zw","en","es-ar","es-bo","es-cl","es-co","es-cr","es-do","es-ec","es-gt","es-hn","es-mx","es-ni","es-pa","es-pe","es-pr","es-py","es-sv","es-us","es-uy","es-ve","es","et","eu","fa","fi","fo","fr-be","fr-ca","fr-ch","fr-lu","fr-mc","fr","gd","gl","gu","he","hi","hr","hu","hy","id","is","it-ch","it","ja","ka","kk","kn","ko","kok","kz","lt","lv","mk","ml","mn","mr","ms","mt","nb-no","ne","nl-be","nl","nn-no","no","or","pa","pl","pt-br","pt","rm","ro-md","ro","ru-md","ru","sa","sb","sk","sl","sq","sr","sv-fi","sv","sw","sx","syr","ta","te","th","tn","tr","ts","tt","uk","ur","uz","vi","xh","yi","zh-cn","zh-hk","zh-mo","zh-sg","zh-tw","zh","zu"]
   if ("enumeration" in c) langs = c.enumeration
   if ("pattern" in c) return '"' + new RandExp(c.pattern).gen() + '"'

   let max = null, min = null

   if (has("length")) {
      if (c.length == 2) langs = langs.filter(x => x.length == 2)
      if (c.length == 5) langs = langs.filter(x => x.length == 5)
   }
   if (has("maxLength")) max = c.maxLength
   if (has("minLength")) max = c.minLength

   if (max !== null && min !== null) {
      if (max >= 2 && min <= 2 && max < 5) langs = langs.filter(x => x.length == 2)
      if (max >= 5 && min <= 5 && min > 2) langs = langs.filter(x => x.length == 5)
   }
   else if (max === null) {
      if (min <= 5 && min > 2) langs = langs.filter(x => x.length == 5)
   }
   else if (min === null) {
      if (max >= 2 && max < 5) langs = langs.filter(x => x.length == 2)
   }

   return `'{{random("${langs.join('","')}")}}'`
}

function parseSimpleType(st) {
   /* if (child.element == "list") {
      let value = "itemType" in child.attrs ? typeToString(parseType(child.attrs.itemType, prefix)) : parseSimpleType(child.content[0].content[0])
      
      let list_len = randomize(3,10)
      return `${value} `.repeat(list_len).slice(0,-1)
   }

   if (child.element == "union") {
      let values = []
      if ("memberTypes" in child.attrs) values = child.attrs.memberTypes.map(x => typeToString(parseType(x, prefix)))
      child.content.forEach(x => values.push(parseSimpleType(x.content[0])))
      
      return values[randomize(0,values.length-1)]
   } */

   // verificar se a faceta em questão existe no conteúdo
   let has = facet => facet in st.content
   let content = st.content.reduce((a,c) => {a[c.element] = c.attrs.value; return a}, {})
   
   switch (st.built_in_base) {
      case "anyURI":
         if ("enumeration" in content) return `'{{random("${content.enumeration.join('","')}")}}'`
         if ("pattern" in content) return '"' + new RandExp(content.pattern).gen() + '"'
         return '"http://www.w3.org/2001/XMLSchema"'

      case "boolean":
         if ("pattern" in content) return '"' + new RandExp(content.pattern).gen() + '"'
         return '"' + (Math.random() < 0.5) + '"'

      case "language":
         return parseLanguage(content, has)

      case "ENTITIES": case "IDREFS": case "NMTOKENS":
      case "base64Binary": case "ENTITY": case "hexBinary": case "ID": case "IDREF": case "Name": case "NCName": 
      case "NMTOKEN": case "normalizedString": case "NOTATION": case "QName": case "string": case "token":
         return parseStringType(content, st.built_in_base, has)

      case "byte": case "decimal": case "double": case "float": case "int": case "integer": case "long": case "negativeInteger": case "nonNegativeInteger":
      case "nonPositiveInteger": case "positiveInteger": case "short": case "unsignedByte": case "unsignedInt": case "unsignedLong": case "unsignedShort":
         return parseNumberType(content, st.built_in_base, has)

      case "date": case "dateTime": case "duration": case "time":
         return parseDateTimeType(content, st.built_in_base, has)

      case "gDay": case "gMonth": case "gYear":
         return parseSimpleGType(content, st.built_in_base, has)

      case "gMonthDay": case "gYearMonth":
         return parseComplexGType(content, st.built_in_base, has)
   }
}

function parseComplexType(el, depth) {
   let parsed = {attrs: "", content: ""}

   parsed.attrs = parseAttributeGroup(el, depth+1)

   for (let i = 0; i < el.content.length; i++) {
      switch (el.content[i].element) {
         case "group": parsed.content = parseGroup(el.content[i], depth+1, {}).str.slice(0, -2); break;
         case "all": parsed.content = parseAll(el.content[i], depth+2, {}).str; break;
         case "sequence": parsed.content = parseSequence(el.content[i], depth+1, {}).str.slice(0, -1); break;
         case "choice": parsed.content = parseChoice(el.content[i], depth+1, {}).str; break;
      }
   }
   
   if (!parsed.attrs.length && !parsed.content.length) return "{ missing(100) {empty: true} }"

   let str = "{\n"
   if (parsed.attrs.length > 0) str += parsed.attrs + ",\n"
   return str + `${parsed.content}\n${indent(depth)}}`
}

function parseType(type) {
   type = getTypeInfo(type)
   let st = simpleTypes[type.type]

   if (!("built_in_base" in st)) st.built_in_base = type.base
   return parseSimpleType(st)
}

const chooseQM = str => str.includes('"') ? "'" : '"'

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

function parseGroup(el, depth, keys) {
   let str = ""

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
      let parsed = parseElement(x, depth, keys)

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

         parsed = parseElement(x, depth, keys)
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

      keys = parsed.keys
   })

   return {str, choice, keys}
}

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


// Funções auxiliares ----------

function randomize(min, max) { return Math.floor(Math.random() * ((max+1) - min) + min) }

function string(base, length) {
   //[".",":","-","_"]
   let alphabet = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","z","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"]
   let alphanumerical = [...alphabet,"0","1","2","3","4","5","6","7","8","9"]

   let space = ["normalizedString","string","token"].includes(base) ? '," "' : ""
   if (base == "base64Binary") alphanumerical = alphanumerical.concat(["+","/"])

   let str = ""
   for (let i = 0; i < length; i++) {
      let arr = (["Name","NCName","ENTITY","ENTITIES","ID","IDREF","IDREFS","NOTATION","QName"].includes(base) && !i) ? alphabet : alphanumerical
      str += `{{random("${arr.join('","')}"${(base == "token" && (!i || i == length-1)) ? "" : space})}}`
   }
   return str
}

function range(size, startAt) {
   return [...Array(size).keys()].map(i => i + startAt);
}

function hexBinary(length) {
   let hexChars = range(60, 20)
   hexChars = hexChars.concat(["2","3","4","5","6","7"].map(x => ["A","B","C","D","E","F"].map(y => x+y)).flat())
   hexChars.pop()

   return `{{random("${hexChars.join('","')}")}}`.repeat(length)
}

module.exports = { convertXSD }