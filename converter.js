// nr de sequências que vão ser criadas na DSL como objetos com a chave DATAGEN_FROM_SCHEMAS_SEQUENCE_\d e convertidas posteriormente na tradução JSON-XML do DataGen
let special_sequences = 0
// strings DSL dos elementos globais
let global_elems = {}

function XSD2DSL(content, prefix) {
   let str = "<!LANGUAGE pt>\n{\n"
   let depth = 1

   // parse de tudo menos <element>s
   parseGlobalEls(content.filter(x => x.element != "element"), prefix, depth)

   let elements = content.filter(x => x.element == "element")
   for (let i = 0; i < elements.length; i++) {
      let {elem_str, _} = parseElement(elements[i], prefix, depth, null)

      if (elem_str.length > 0) {
         str += '\t'.repeat(depth) + elem_str
         if (i < elements.length-1) str += ","
         str += "\n"
      }
   }

   str += "}"
   return str
}

function parseGlobalEls(content, prefix, depth) {
   let groups = content.filter(x => x.element == "group")
   for (let i = 0; i < groups.length; i++) global_elems[groups[i].attrs.name] = parseGroup(groups[i], prefix, depth+1, {}).str
   console.log(global_elems)
}

function parseElement(el, prefix, depth, keys) {
   // schemaElem indica se é o <element> é uma coleção ou não
   let elem_str = "", schemaElem = keys === null
   // se for aninhado, numerar as suas ocorrências para não dar overwrite na geração do DataGen
   let name = () => `${el.attrs.name}${schemaElem ? "" : `_${keys[el.attrs.name]++}__DATAGEN_FROM_SCHEMAS`}: ` 
   let occurs = schemaElem ? 1 : randomize(el.attrs.minOccurs, el.attrs.maxOccurs)

   for (let i = 0; i < occurs; i++) {
      // converte o valor do elemento para string DSL
      let parsed = parseElementAux(el, prefix, depth)

      // completa a string DSL com a chave e formatação
      if (parsed.length > 0) elem_str += name() + parsed + (i < occurs-1 ? `,\n${'\t'.repeat(depth)}` : "")
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
        
        return values[randomize(0,values.length-1)]
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
   let group = el.content.filter(x => x.element == "group")
   if (group.length > 0) return parseGroup(group[0], prefix, depth+1, {})

   let all = el.content.filter(x => x.element == "all")
   if (all.length > 0) return parseAll(all[0], prefix, depth+1, {})
   
   let sequence = el.content.filter(x => x.element == "sequence")
   if (sequence.length > 0) return "{\n" + parseSequence(sequence[0], prefix, depth+1, {}).str.slice(0, -1) + `\n${'\t'.repeat(depth)}}`
   
   let choice = el.content.filter(x =>  x.element == "choice")
   if (choice.length > 0) return "{\n" + parseChoice(choice[0], prefix, depth+1, {}).str + `\n${'\t'.repeat(depth)}}`
}

function parseGroup(el, prefix, depth, keys) {
   let str = ""

   // repetir os filhos um nr aleatório de vezes, entre os limites dos atributos max/minOccurs
   for (let i = 0; i < randomize(el.attrs.minOccurs, el.attrs.maxOccurs); i++) {
      let parsed

      switch (el.content[0].element) {
         case "all": parsed = parseAll(el.content[0], prefix, depth, keys); break;
         case "choice": parsed = parseChoice(el.content[0], prefix, depth, keys); break;
         case "sequence": parsed = parseSequence(el.content[0], prefix, depth, keys); break;
      }

      str += parsed.str + "\n"
      keys = parsed.keys
   }

   return {str, keys}
}

function parseAll(el, prefix, depth, keys) {
   let elements = el.content.filter(x => x.element == "element")
   let elements_str = [], nr_elems = 0

   // se minOccurs = 0, dar uma probabilidade de 30% de o elemento não aparecer no XML
   if (!el.attrs.minOccurs && Math.random() < 0.3) return ""

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
         elements_str.push(`\n${'\t'.repeat(depth)}${parsed.elem_str},`)
      }
   })

   // usar a primitiva at_least para randomizar a ordem dos elementos
   let str = `{ at_least(${nr_elems}) {`
   str += elements_str.join("")
   str = str.slice(0, -1) + `\n${'\t'.repeat(--depth)}} }`

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
      str += `${'\t'.repeat(depth++)}or() {\n`

      let parsed = parseCT_child_content(el.element, str, el.content, prefix, depth, keys)
      keys = parsed.keys

      str = parsed.str.slice(0, -2) + `\n${'\t'.repeat(--depth)}},\n`
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
         if (parsed.elem_str.length > 0) str += `${'\t'.repeat(depth)}${parsed.elem_str},\n`
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
               str += `${'\t'.repeat(depth)}DATAGEN_FROM_SCHEMAS__SEQUENCE_${++special_sequences}: {\n${parsed.str}\n${'\t'.repeat(depth)}},\n`
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
   if (type == "gDay") dsl = [{moustache: "integer", args: ["1", "31"]}]
   if (type == "gMonth") dsl = [{moustache: "integer", args: ["1", "12"]}]
   if (type == "gYear") dsl = [{moustache: "integer", args: ["1950", "2010"]}]
   if (type == "gYearMonth") dsl = [{moustache: "integer", args: ["1950", "2010"]}, "-", {moustache: "integer", args: ["1", "12"]}]
   if (type == "gMonthDay") dsl = ["--", {moustache: "integer", args: ["1", "12"]}, "-", {moustache: "integer", args: ["1", "31"]}]
   if (type == "duration") dsl = ["P", {moustache: "integer", args: ["1950", "2010"]}, "Y", {moustache: "integer", args: ["1", "12"]}, "M", {moustache: "integer", args: ["1", "31"]}, "DT", {moustache: "integer", args: ["0", "23"]}, "H", {moustache: "integer", args: ["0", "59"]}, "M", {moustache: "integer", args: ["0", "59"]}, "S"]

   // string
   if (type == "string") dsl = [{moustache: "lorem", args: ['"phrase"', "1", "3"]}]
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
      "element": "complexType",
      "attrs": {
         "name": "ShirtType",
         "abstract": false,
         "mixed": false
      },
      "content": [
         {
            "element": "sequence",
            "attrs": {
               "maxOccurs": 1,
               "minOccurs": 1
            },
            "content": [
               {
                  "element": "group",
                  "attrs": {
                     "name": "ProductPropertyGroup",
                     "maxOccurs": 1,
                     "minOccurs": 0
                  },
                  "content": [
                     {
                        "element": "sequence",
                        "attrs": {
                           "maxOccurs": 1,
                           "minOccurs": 1
                        },
                        "content": [
                           {
                              "element": "group",
                              "attrs": {
                                 "name": "DescriptionGroup",
                                 "maxOccurs": 1,
                                 "minOccurs": 1
                              },
                              "content": [
                                 {
                                    "element": "sequence",
                                    "attrs": {
                                       "maxOccurs": 1,
                                       "minOccurs": 1
                                    },
                                    "content": [
                                       {
                                          "element": "element",
                                          "attrs": {
                                             "name": "description",
                                             "type": "xs:string",
                                             "maxOccurs": 1,
                                             "minOccurs": 1,
                                             "abstract": false,
                                             "nillable": false
                                          },
                                          "content": []
                                       },
                                       {
                                          "element": "element",
                                          "attrs": {
                                             "name": "comment",
                                             "type": "xs:string",
                                             "minOccurs": 0,
                                             "maxOccurs": 1,
                                             "abstract": false,
                                             "nillable": false
                                          },
                                          "content": []
                                       }
                                    ]
                                 }
                              ]
                           },
                           {
                              "element": "element",
                              "attrs": {
                                 "name": "number",
                                 "type": "xs:integer",
                                 "maxOccurs": 1,
                                 "minOccurs": 1,
                                 "abstract": false,
                                 "nillable": false
                              },
                              "content": []
                           },
                           {
                              "element": "element",
                              "attrs": {
                                 "name": "name",
                                 "type": "xs:string",
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
               },
               {
                  "element": "element",
                  "attrs": {
                     "name": "size",
                     "type": "SizeType",
                     "maxOccurs": 1,
                     "minOccurs": 1,
                     "abstract": false,
                     "nillable": false
                  },
                  "content": []
               }
            ]
         },
         {
            "element": "attributeGroup",
            "attrs": {
               "name": "IdentifierGroup"
            },
            "content": [
               {
                  "element": "attribute",
                  "attrs": {
                     "name": "id",
                     "type": "xs:ID",
                     "use": "required"
                  },
                  "content": []
               },
               {
                  "element": "attribute",
                  "attrs": {
                     "name": "version",
                     "type": "xs:decimal",
                     "use": "optional"
                  },
                  "content": []
               }
            ]
         },
         {
            "element": "attribute",
            "attrs": {
               "name": "effDate",
               "type": "xs:date",
               "use": "optional"
            },
            "content": []
         }
      ]
   },
   {
      "element": "group",
      "attrs": {
         "name": "DescriptionGroup",
         "maxOccurs": 1,
         "minOccurs": 3
      },
      "content": [
         {
            "element": "sequence",
            "attrs": {
               "maxOccurs": 1,
               "minOccurs": 1
            },
            "content": [
               {
                  "element": "element",
                  "attrs": {
                     "name": "description",
                     "type": "xs:string",
                     "maxOccurs": 1,
                     "minOccurs": 1,
                     "abstract": false,
                     "nillable": false
                  },
                  "content": []
               },
               {
                  "element": "element",
                  "attrs": {
                     "name": "comment",
                     "type": "xs:string",
                     "minOccurs": 0,
                     "maxOccurs": 1,
                     "abstract": false,
                     "nillable": false
                  },
                  "content": []
               }
            ]
         }
      ]
   },
   {
      "element": "group",
      "attrs": {
         "name": "ProductPropertyGroup",
         "maxOccurs": 1,
         "minOccurs": 1
      },
      "content": [
         {
            "element": "sequence",
            "attrs": {
               "maxOccurs": 1,
               "minOccurs": 1
            },
            "content": [
               {
                  "element": "group",
                  "attrs": {
                     "name": "DescriptionGroup",
                     "maxOccurs": 1,
                     "minOccurs": 1
                  },
                  "content": [
                     {
                        "element": "sequence",
                        "attrs": {
                           "maxOccurs": 1,
                           "minOccurs": 1
                        },
                        "content": [
                           {
                              "element": "element",
                              "attrs": {
                                 "name": "description",
                                 "type": "xs:string",
                                 "maxOccurs": 1,
                                 "minOccurs": 1,
                                 "abstract": false,
                                 "nillable": false
                              },
                              "content": []
                           },
                           {
                              "element": "element",
                              "attrs": {
                                 "name": "comment",
                                 "type": "xs:string",
                                 "minOccurs": 0,
                                 "maxOccurs": 1,
                                 "abstract": false,
                                 "nillable": false
                              },
                              "content": []
                           }
                        ]
                     }
                  ]
               },
               {
                  "element": "element",
                  "attrs": {
                     "name": "number",
                     "type": "xs:integer",
                     "maxOccurs": 1,
                     "minOccurs": 1,
                     "abstract": false,
                     "nillable": false
                  },
                  "content": []
               },
               {
                  "element": "element",
                  "attrs": {
                     "name": "name",
                     "type": "xs:string",
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
   },
   {
      "element": "attributeGroup",
      "attrs": {
         "name": "IdentifierGroup"
      },
      "content": [
         {
            "element": "attribute",
            "attrs": {
               "name": "id",
               "type": "xs:ID",
               "use": "required"
            },
            "content": []
         },
         {
            "element": "attribute",
            "attrs": {
               "name": "version",
               "type": "xs:decimal",
               "use": "optional"
            },
            "content": []
         }
      ]
   },
   {
      "element": "complexType",
      "attrs": {
         "name": "SizeType",
         "abstract": false,
         "mixed": false
      },
      "content": [
         {
            "element": "simpleContent",
            "attrs": {},
            "content": [
               {
                  "element": "extension",
                  "attrs": {
                     "base": "xs:integer"
                  },
                  "content": [
                     {
                        "element": "attribute",
                        "attrs": {
                           "name": "system",
                           "type": "xs:token",
                           "use": "optional"
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