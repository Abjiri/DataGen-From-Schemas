const RandExp = require('randexp');

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


// Funções de tradução de tipos embutidos ----------

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
       let base = "${base}", max = ${JSON.stringify(max)}, min = ${JSON.stringify(min)}
 
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
          
          let time, date = max !== null ? gen.date(min.date[0], max.date[0], "YYYY-MM-DD") : gen.date(min.date[0], "YYYY-MM-DD")
          
          if (base == "dateTime") {
             let randomize = (max,min) => Math.floor(Math.random() * ((max+1) - min) + min)
             
             if (max !== null && date == max.date[0]) time = gen.time("hh:mm:ss", 24, false, max.date[1], "23:59:59")
             else if (date == min.date[0]) time = gen.time("hh:mm:ss", 24, false, "00:00:00", min.date[1])
             else time = gen.time("hh:mm:ss", 24, false)
          }
 
          if ((max !== null && date > max.date[0]) || date < min.date[0]) date = "-" + date
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
 
                   let sum = arr => arr.reduce((c,a) => c+a, 0)
                   if (max[0] == 1 && !min[0] && !sum(max.slice(1)) && !sum(min.slice(1))) rand.new = 0
                   if (rand.new != 0) str += rand.new + units[i]
                }
             }
             else {
                let next_part
 
                if (rand.new == rand.inf) next_part = randomize(maxPossible[i], min[i])
                else if (rand.new == rand.sup) next_part = randomize(max[i], 0)
                else next_part = randomize(maxPossible[i], 0)
 
                if (next_part > 0) str += next_part + units[i]
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
    if ("pattern" in c && c.pattern != "([a-zA-Z]{2}|[iI]-[a-zA-Z]+|[xX]-[a-zA-Z]{1,8})(-[a-zA-Z]{1,8})*") return '"' + new RandExp(c.pattern).gen() + '"'
 
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
    let content = st.content.reduce((a,c) => {a[c.element] = c.attrs.value; return a}, {})
    let has = facet => facet in content
    
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


module.exports = { parseSimpleType }