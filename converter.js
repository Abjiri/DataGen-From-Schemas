function XSD2DSL(content, prefix) {
    let str = "<!LANGUAGE pt>\n{\n"
    let depth = 1

    // parse de tudo menos <element>s

    let elements = content.filter(x => x.element == "element")
    for (let i = 0; i < elements.length; i++) {
        let collection = parseElement(elements[i], prefix, depth)

        if (collection.length > 0) {
            str += '\t'.repeat(depth) + collection
            if (i < elements.length-1) str += ","
            str += "\n"
        }
    }

    str += "}"
    return str
}

function parseElement(el, prefix, depth) {
    let name = `${el.attrs.name}: `, str = ""
    let occurs = "maxOccurs" in el.attrs ? randomize(el.attrs.minOccurs, el.attrs.maxOccurs) : 1

    for (let i = 0; i < occurs; i++) {
        let parsed = parseElementAux(el, prefix, depth)
        if (parsed.length > 0) str += name + parsed + (i < occurs-1 ? `,\n${'\t'.repeat(depth)}` : "")
    }

    return str
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
    if ("type" in attrs) return `'${typeToString(parseType(attrs.type, prefix))}'` /* arranjar maneira de dar randomize aos tipos cujo valor calculo aqui e não no DataGen */
    if ("default" in attrs) return attrs.default /* verificar como é que é possível especificar valores diferentes do default na schema */

    // parsing do conteúdo -----
    let simpleType = el.content.filter(x => x.element == "simpleType")
    if (simpleType.length > 0) return `'${parseSimpleType(simpleType[0].content[0], prefix)}'` // a parte relevante do simpleType é o elemento filho (list / restriction / union)

    let complexType = el.content.filter(x => x.element == "complexType")
    if (complexType.length > 0) {
        let ct_value = parseComplexType(complexType[0], prefix, depth)
        return !ct_value.length ? "{}" : (ct_value)
    }
}

function parseSimpleType(child, prefix) {
    if (child.element == "list") {
        let value = "itemType" in child.attrs ? typeToString(parseType(child.attrs.itemType, prefix)) : parseSimpleType(child.content[0].content[0], prefix) /* não sei se isto funciona */
        
        let list_len = randomize(3,10)
        return `${value} `.repeat(list_len).slice(0,-1)
    }

    if (child.element == "union") {
        let values = []
        if ("memberTypes" in child.attrs) values = child.attrs.memberTypes.map(x => typeToString(parseType(x, prefix)))
        child.content.forEach(x => values.push(parseSimpleType(x.content[0], prefix)))
        
        return `${values[randomize(0,values.length-1)]}`
    }

    if (child.element == "restriction") {
        let base = parseType(attrs.base, prefix)
        let moustache = base[base.length-1]

        /* o que faz o simpleType filho numa restriction? */
        child.content.forEach(x => {
            /* para já, só vou assumir max/min Inc/Exc para tipos numéricos */
            if (x.element == "minInclusive") moustache.args[0] = x.attrs.value
            if (x.element == "maxInclusive") moustache.args[1] = x.attrs.value
            if (x.element == "minExclusive") moustache.args[0] = x.attrs.value + (moustache.moustache == "integer" ? 1 : 0.001)
            if (x.element == "maxExclusive") moustache.args[1] = x.attrs.value - (moustache.moustache == "integer" ? 1 : 0.001)
        })

        base[base.length-1] = moustache
        return typeToString(base)
    }
}

function parseComplexType(el, prefix, depth) {
    let all = el.content.filter(x => x.element == "all")
    if (all.length > 0) return parseAll(all[0], prefix, depth+1)
}

function parseAll(el, prefix, depth) {
    let elements = el.content.filter(x => x.element == "element")

    // se minOccurs = 0, dar uma probabilidade de 30% de o elemento não aparecer no XML
    if (!el.attrs.minOccurs && Math.random() < 0.3) return ""

    let elements_str = [], nr_elems = 0

    elements.forEach(x => {
        // dar parse a cada elemento
        let elem_str = parseElement(x, prefix, depth)

        if (elem_str.length > 0) {
            // contar o nr de elementos total (tendo em conta max/minOccurs de cada um)
            nr_elems += (elem_str.match(/\n/g) || []).length

            // dar parse a todos os elementos e guardar as respetivas strings num array
            elements_str.push(`\n${'\t'.repeat(depth)}${elem_str},`)
        }
    })

    // usar a primitiva at_least para randomizar a ordem dos elementos
    let str = `{ at_least(${nr_elems}) {`
    str += elements_str.join("")
    str = str.slice(0, -1) + `\n${'\t'.repeat(--depth)}} }`

    return str
}

let built_in_types = ["float","double","decimal","integer","nonPositiveInteger","nonNegativeInteger","negativeInteger","positiveInteger","long","int","short","byte","unsignedLong","unsignedInt","unsignedShort","unsignedByte",
                      "dateTime","date","time","gDay","gMonth","gYear","gYearMonth","gMonthDay","duration",
                      "string","normalizedString","token",
                      "hexBinary","base64Binary",
                      "boolean"]

function parseType(type, prefix) {
    if (type.includes(':')) {
        let split = type.split(':')

        if (split[0] == prefix) {
            type = split[1] // remover o prefixo do nome do tipo

            if (!built_in_types.includes(type)) {} // é um tipo local da schema
        }
        else {} // é um tipo de outra schema
    }

    let dsl

    // numéricos
    if (type == "float") dsl = [Math.random() < 0.5 ? "-" : "", {moustache: "float", args: [0.0000000000000000000000000000000000000118, 340000000000000000000000000000000000000]}]
    if (type == "double") dsl = [Math.random() < 0.5 ? "-" : "", {moustache: "float", args: [0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000223, 18000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000]}]
    if (type == "decimal") dsl = [{moustache: "float", args: [-999999999999999999999999999999.999, 999999999999999999999999999999.999]}]
    if (type == "integer") dsl = [{moustache: "integer", args: [-999999999999999999999999999999, 999999999999999999999999999999]}]
    if (type == "nonPositiveInteger") dsl = [{moustache: "integer", args: [-999999999999999999999999999999, 0]}]
    if (type == "nonNegativeInteger") dsl = [{moustache: "integer", args: [0, 999999999999999999999999999999]}]
    if (type == "negativeInteger") dsl = [{moustache: "integer", args: [-999999999999999999999999999999, -1]}]
    if (type == "positiveInteger") dsl = [{moustache: "integer", args: [1, 999999999999999999999999999999]}]
    if (type == "long") dsl = [{moustache: "integer", args: [-9223372036854775808, 9223372036854775807]}]
    if (type == "int") dsl = [{moustache: "integer", args: [-2147483648, 2147483647]}]
    if (type == "short") dsl = [{moustache: "integer", args: [-32768, 32767]}]
    if (type == "byte") dsl = [{moustache: "integer", args: [-128, 127]}]
    if (type == "unsignedLong") dsl = [{moustache: "integer", args: [0, 18446744073709551615]}]
    if (type == "unsignedInt") dsl = [{moustache: "integer", args: [0, 4294967295]}]
    if (type == "unsignedShort") dsl = [{moustache: "integer", args: [0, 65535]}]
    if (type == "unsignedByte") dsl = [{moustache: "integer", args: [0, 255]}]

    // data/hora
    if (type == "dateTime") dsl = [{moustache: "date", args: ['"01-01-1950"']}]
    if (type == "date") dsl = [{moustache: "date", args: ['"01-01-1950"', '"YYYY-MM-DD"']}]
    if (type == "time") dsl = [{moustache: "time", args: ['"hh:mm:ss"', 24, false]}]
    if (type == "gDay") dsl = [{moustache: "integer", args: [1, 31]}]
    if (type == "gMonth") dsl = [{moustache: "integer", args: [1, 12]}]
    if (type == "gYear") dsl = [{moustache: "integer", args: [1950, 2010]}]
    if (type == "gYearMonth") dsl = [{moustache: "integer", args: [1950, 2010]}, "-", {moustache: "integer", args: [1, 12]}]
    if (type == "gMonthDay") dsl = ["--", {moustache: "integer", args: [1, 12]}, "-", {moustache: "integer", args: [1, 31]}]
    if (type == "duration") dsl = ["P", {moustache: "integer", args: [1950, 2010]}, "Y", {moustache: "integer", args: [1, 12]}, "M", {moustache: "integer", args: [1, 31]}, "DT", {moustache: "integer", args: [0, 23]}, "H", {moustache: "integer", args: [0, 59]}, "M", {moustache: "integer", args: [0, 59]}, "S"]

    // string
    if (type == "string") dsl = [randomString(randomize(10,50))]
    if (type == "normalizedString") dsl = [randomString(randomize(10,50)).replace(/[\t\n\r]/g," ")]
    if (type == "token") dsl = [randomString(randomize(10,50)).trim().replace(/[\t\n\r]/g," ").replace(/ +/g," ")]

    // binários
    if (type == "hexBinary") dsl = [randomString(randomize(10,50)).hexEncode()]
    if (type == "base64Binary") dsl = [btoa(randomString(randomize(10,50)))]

    // boolean
    if (type == "boolean") dsl = [{moustache: "boolean", args: []}]

    if (type == "ID") dsl = [{moustache: "guid", args: []}]

    return dsl
}

const typeToString = arr => arr.reduce((accum, curr) => accum += (typeof curr == "string" ? curr : `{{${curr.moustache}(${curr.args.join(",")})}}`), "")



// funções auxiliares ----------
function randomString(length) {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \t\n';
    let charactersLength = characters.length;

    let result = '';
    for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * charactersLength))
    return result;
}

function randomize(min, max) { return Math.floor(Math.random() * ((max+1) - min) + min) }

const btoa = str => Buffer.from(str, 'binary').toString('base64')

String.prototype.hexEncode = function(){
    var hex, i;

    var result = "";
    for (i=0; i<this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000"+hex).slice(-4);
    }

    return result
}



// TESTE

let content = [
    {
       "element": "element",
       "attrs": {
          "name": "AA",
          "abstract": false,
          "nillable": false
       },
       "content": [
          {
             "element": "complexType",
             "attrs": {
                "abstract": false,
                "mixed": false
             },
             "content": [
                {
                   "element": "all",
                   "attrs": {
                      "minOccurs": 0,
                      "maxOccurs": 1
                   },
                   "content": [
                      {
                         "element": "element",
                         "attrs": {
                            "name": "title",
                            "type": "xs:int",
                            "minOccurs": 0,
                            "maxOccurs": 1,
                            "abstract": false,
                            "nillable": false
                         },
                         "content": []
                      },
                      {
                         "element": "element",
                         "attrs": {
                            "name": "forename",
                            "type": "xs:date",
                            "minOccurs": 0,
                            "maxOccurs": 10,
                            "abstract": false,
                            "nillable": false
                         },
                         "content": []
                      },
                      {
                         "element": "element",
                         "attrs": {
                            "name": "surname",
                            "type": "xs:byte",
                            "maxOccurs": 1,
                            "minOccurs": 1,
                            "abstract": false,
                            "nillable": false
                         },
                         "content": []
                      }
                   ]
                }
             ]
          }
       ]
    }
 ]

console.log(XSD2DSL(content, "xs"))