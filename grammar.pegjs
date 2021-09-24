// Gramática para "DataGen from Schemas" -----

{
  // Geral ------------------------------

  // verificar se o elemento pai é o <schema>
  const atRoot = () => !schema_depth
  // verificar se não foi definido um prefixo para a schema
  const noSchemaPrefix = () => default_prefix === null
  // verificar se o prefixo usado foi declarado na definição da schema
  const existsPrefix = p => prefixes.includes(p) ? true : error("Este prefixo não foi declarado no início da schema!")
  // verificar se as aspas/apóstrofes são fechados consistentemente
  const checkQM = (q1,q2) => q1 === q2 ? true : error("Deve encapsular o valor em aspas ou em apóstrofes. Não pode usar um de cada!")
  // criar um objeto de boleanos a partir de um array com os nomes das propriedades pretendidas
  const createObjectFrom = arr => arr.reduce((obj,item) => { obj[item] = 0; return obj }, {})
  // juntar todos os atributos do elemento num só objeto
  const getAttrs = objArr => objArr.reduce(((r,c) => { r[c.attr] = c.val; return r }), {})


  // Schema ------------------------------

  // prefixo definido na declaração da schema
  let default_prefix = null
  // prefixos de namespaces declarados na schema
	let prefixes = []
  // atributos da schema
  let schema_attrs = {}
  // número de elementos aninhados dentro do <schema> correntemente
  let schema_depth = 0

  // validar os atributos do elemento <schema>
  function check_schemaAttrs(arr) {
    // obrigatoriamente tem atributos (no mínimo a definição do namespace)
    if (arr.length < 1) return error("O elemento <schema> requer, no mínimo, a definição do namespace!")

    let keys = [], // array com os nomes dos atributos
        attrs = {namespaces: {}}, // objeto com os valores dos atributos
        null_namespace = "" // para guardar o URI do namespace predefinido, caso não tenha prefixo
        
    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos (pode haver várias definições de namespaces)
      if (keys.includes(arr[i].attr) && arr[i].attr != "namespace") return error("O elemento <schema> não pode possuir atributos repetidos!")
      else {
        // guardar a chave "namespace" apenas 1x
        if (!keys.includes(arr[i].attr)) keys.push(arr[i].attr)
        // guardar o valor no objeto attrs
        if (arr[i].attr == "namespace") {
          if (arr[i].prefix === null) {
            // verificar que só há, no máximo, 1 namespace sem prefixo
            if (null_namespace.length > 0) return error("Não pode haver vários namespaces sem prefixo associado!")
            else null_namespace = arr[i].val
          }
          else {
            // verificar que não há prefixos de namespaces repetidos
            if (arr[i].prefix in attrs.namespaces) return error("Todos os prefixos de namespaces devem ser únicos!")
            else attrs.namespaces[arr[i].prefix] = arr[i].val
          }
        }
        else attrs[arr[i].attr] = arr[i].val
      }
    }

    // a definição do namespace é obrigatória
    if (!Object.keys(attrs.namespaces).length && !null_namespace.length) return error("O elemento <schema> requer a definição do namespace!")
    // verificar que a definição de um namespace e, opcionalmente, prefixo predefinidos está correta e coerente
    if (default_prefix === null && !null_namespace.length) return error("Precisa de prefixar o elemento <schema> com o prefixo do namespace predefinido!")
    if (default_prefix !== null && null_namespace.length > 0) {
      if (!(default_prefix in attrs.namespaces)) return error("Precisa de associar o prefixo do elemento <schema> a um namespace!")
    }

    // atributos com valores predefinidos
    if (!keys.includes("attributeFormDefault")) attrs.attributeFormDefault = "unqualified"
    if (!keys.includes("elementFormDefault")) attrs.elementFormDefault = "unqualified"

    schema_attrs = attrs
    return attrs
  }

  // validar os atributos do elemento <import>
  function check_importAttrs(arr) {
    let keys = [] // array com os nomes dos atributos
        
    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos
      if (keys.includes(arr[i].attr)) return error("O elemento <import> não pode possuir atributos repetidos!")
      else keys.push(arr[i].attr)
    }

    return true
  }
  

  // <element> ------------------------------

  //nomes (únicos) dos elementos <element> globais, <attribute> globais e <notation>
  let names = {element: [], attribute: [], notation: []}
  // atributos "id" de elementos da schema - têm de ser únicos
  let ids = []

  // validar um elemento <element/attribute> básico - verificar que tem os atributos essenciais
  const validateLocalEl = attrs => "ref" in attrs || "name" in attrs
  // verificar se o novo id é único na schema
  const validateID = id => !ids.includes(id) ? true : error("O valor do atributo 'id' deve ser único na schema!")
  // validar se o atributo "ref" está a referenciar um <element/attribute> global válido da schema ou de uma schema importada (só se valida o prefixo, neste caso)
  const validateRef = (ref, el_name) => (ref.includes(":") || names[el_name].includes(ref)) ? true : error(`Está a tentar referenciar um elemento <${el_name}> inexistente! Só é possível referenciar elementos globais.`)
  // se for null, converte para array vazio; senão, remove os nulls do array
  const cleanContent = content => content === null ? [] : content.filter(e => e !== null)

  // validar o nome de um <element/attribute/notation> - deve ser único
  function validateName(name, el_name) {
    // se for um <element/attribute>, é preciso verificar que são elementos globais
    if (el_name == "notation" || atRoot()) {
      if (!names[el_name].includes(name)) {names[el_name].push(name); return true}
      return error(`Todos os elementos <${el_name}> ${el_name != "notation" ? "definidos globalmente " : ""}devem ter nomes únicos!`)
    }
    return true
  }
  
  // validar as tags de abertura e fecho de um elemento - prefixos e nomes de elementos coesos
  function check_elTags(el_name, prefix, close) {
    // merged é um boleano que indica se a abertura e fecho são feitos no mesmo elemento ou não
    if (!close.merged) {
      if (el_name !== close.name) return error(`Os elementos de abertura <${el_name}> e de fecho <${close.name}> devem dizer respeito ao mesmo elemento!`)
      if (prefix !== close.prefix) return error(`O prefixo do elemento de fecho do <${el_name}> tem de ser igual ao prefixo do elemento de abertura!`)
    }
    
    if (prefix !== null && prefix !== default_prefix) return error("Prefixo inválido!")
    if (prefix === null && !noSchemaPrefix()) return error("Precisa de prefixar o elemento com o prefixo do respetivo namespace!")

    return true
  }
  
  // verificar que um elemento <element> não tem o atributo "ref" e um dos elementos filhos mutualmente exclusivos com esse
  function check_elemMutex(attrs, content) {
    if ("ref" in attrs && content.some(x => ["simpleType","complexType","key","keyref","unique"].includes(x.element)))
      return error(`Se o atributo "ref" está presente num elemento <element>, o seu conteúdo não pode conter nenhum elemento <simpleType>, <complexType>, <key>, <keyref> ou <unique>!`)
    return true
  }

  // verificar que um elemento <attribute> não tem um elemento filho <simpleType> e um dos atributos mutualmente exclusivos com esse
  function check_attrMutex(attrs, content) {
    let error_msg = attr => `O atributo "${attr}" só pode estar presente no elemento <attribute> quando o seu conteúdo não contém um elemento <simpleType>!`

    if (content.some(x => x.element === "simpleType")) {
      if ("type" in attrs) return error(error_msg("type"))
      if ("ref" in attrs) return error(error_msg("ref"))
    }

    return true
  }

  // verificar que um elemento não tem <attribute> locais com o mesmo nome
  function validateLocalAttrs(elem, content) {
    // filtrar apenas os elementos <attribute> do conteúdo e ir buscar os respetivos atributos "name"
    let names = content.filter(x => x.element == "attribute").map(x => x.attrs.filter(a => a.attr=="name")[0])
    // remover os atributos que não têm nome (têm ref) e mapear os restos para o valor do nome
    names = names.filter(x => x != undefined).map(x => x.val)

    // verificar se há nomes repetidos no array
    let duplicates = names.filter((item, index) => names.indexOf(item) !== index)
    if (duplicates.length > 0) return error(`Os atributos locais de um elemento devem ter todos nomes distintos entre si! Neste caso, o elemento <${elem}> tem mais do que um atributo com o nome '${duplicates[0]}'.`)
    return true
  }

  // construir um array com os nomes de todos os atributos do elemento
  function getAttrsKeys(arr, el_name) {
    let keys = [] // array com os nomes dos atributos

    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos
      if (keys.includes(arr[i].attr)) return error(`O elemento <${el_name}> não pode possuir atributos repetidos!`)
      else keys.push(arr[i].attr)
    }

    return keys
  }

  // validar os atributos de um elemento <element>
  function check_elemAttrs(arr) {
    let keys = [], // array com os nomes dos atributos
        maxOccurs = 0, minOccurs = 0
        
    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos
      if (keys.includes(arr[i].attr)) return error("O elemento <element> não pode possuir atributos repetidos!")
      else {
        keys.push(arr[i].attr)
        if (arr[i].attr === "maxOccurs") maxOccurs = arr[i].val
        if (arr[i].attr === "minOccurs") minOccurs = arr[i].val
      }
    }

    // restrições relativas à profundidade dos elementos
    if (atRoot()) { // elementos da schema
      let error_msg = attr => `O atributo "${attr}" é proibido num elemento <element> de schema!`

      if (keys.includes("ref")) return error(error_msg("ref"))
      if (keys.includes("maxOccurs")) return error(error_msg("maxOccurs"))
      if (keys.includes("minOccurs")) return error(error_msg("minOccurs"))
      if (!keys.includes("name")) return error(error_msg("name"))
    }
    // elementos aninhados
    else if (keys.includes("final")) return error('O atributo "final" é proibido num elemento <element> aninhado!')

    // mensagem de erro de atributos mutuamente exclusivos
    let mutexc_error = (a1,a2) => error(`Em elementos <element>, os atributos "${a1}" e "${a2}" são mutuamente exclusivos!`)
    // atributos mutuamente exclusivos
    if (keys.includes("default") && keys.includes("fixed")) return mutexc_error("default","fixed")
    if (keys.includes("ref") && keys.includes("block")) return mutexc_error("ref","block")
    if (keys.includes("ref") && keys.includes("default")) return mutexc_error("ref","default")
    if (keys.includes("ref") && keys.includes("fixed")) return mutexc_error("ref","fixed")
    if (keys.includes("ref") && keys.includes("form")) return mutexc_error("ref","form")
    if (keys.includes("ref") && keys.includes("name")) return mutexc_error("ref","name")
    if (keys.includes("ref") && keys.includes("nillable")) return mutexc_error("ref","nillable")
    if (keys.includes("ref") && keys.includes("type")) return mutexc_error("ref","type")

    // maxOccurs não pode ser inferior a minOccurs
    if (keys.includes("maxOccurs") && keys.includes("minOccurs") && maxOccurs < minOccurs)
      return error('A propriedade "maxOccurs" do elemento não pode ser inferior à "minOccurs"!')

    // atributos com valores predefinidos
    if (!keys.includes("abstract")) arr.push({attr: "abstract", val: false})
    //if (!keys.includes("form")) attrs.form = //valor do atributo elementFormDefault do elemento da schema
    if (!keys.includes("nillable")) arr.push({attr: "nillable", val: false})

    return arr
  }

  // validar os atributos de um elemento <attribute>
  function check_attributeAttrs(arr) {
    let keys = getAttrsKeys(arr, "attribute") // array com os nomes dos atributos

    // restrições relativas à profundidade dos elementos
    if (atRoot()) { // elementos da schema
      if (keys.includes("ref")) return error('O atributo "ref" é proibido num elemento <attribute> de schema!')
      if (!keys.includes("name")) return error('O atributo "name" é requirido num elemento <attribute> de schema!')
    }

    // mensagem de erro de atributos mutuamente exclusivos
    let mutexc_error = (a1,a2) => error(`Em elementos <attribute>, os atributos "${a1}" e "${a2}" são mutuamente exclusivos!`)
    // atributos mutuamente exclusivos
    if (keys.includes("default") && keys.includes("fixed")) return mutexc_error("default","fixed")
    if (keys.includes("ref") && keys.includes("form")) return mutexc_error("ref","form")
    if (keys.includes("ref") && keys.includes("name")) return mutexc_error("ref","name")
    if (keys.includes("ref") && keys.includes("type")) return mutexc_error("ref","type")

    // atributos com valores predefinidos
    if (!keys.includes("use")) arr.push({attr: "use", val: "optional"})

    return arr
  }

  // validar os atributos de um elemento <notation>
  function check_notationAttrs(arr) {
    let keys = getAttrsKeys(arr, "notation") // array com os nomes dos atributos

    // atributos requiridos
    if (!keys.includes("name")) return error(`No elemento <notation> é requirido o atributo "name"!`)
    if (!keys.includes("public") && !keys.includes("system")) return error(`No elemento <notation> é requirido pelo menos um dos atributos "public" e "system"!`)

    return true
  }


  // <simpleType> e <complexType> ------------------------------
  
  // número de simple/complexTypes aninhados correntemente
  let type_depth = 0
  // nome do simple/complexType a ser processado neste momento
  let current_type = null
  // nomes dos novos tipos definidos na schema - têm de ser únicos
  let local_types = {simple: [], complex: []}
  // boleano para indicar se um tipo referenciado tem de corresponder a um tipo built-in ou simpleType apenas (false), ou pode ser um complexType também (true) 
  let any_type = true

  // verificar se já existe algum tipo local com este nome
  const existsLocalType = type => local_types.simple.includes(type) || any_type && local_types.complex.includes(type)
  // verificar que o tipo local que está a ser referenciado existe
  const validateLocalType = type => !existsLocalType(type) ? error(`Tem de referenciar um tipo embutido${any_type ? ", simpleType ou complexType" : " ou simpleType"} válido!`) : 
                                                             (type === current_type ? error("Não pode referenciar um tipo local dentro do seu próprio elemento!") : true)
  // validar um elemento <union> - verificar que referencia algum tipo
  const validateUnion = (attrs,content) => ("memberTypes" in attrs ? attrs.memberTypes.length : 0) + content.filter(e => e.element === "simpleType").length > 0 ? true : 
                                           error(`Um elemento <union> deve ter o atributo "memberTypes" não vazio e/ou pelo menos um elemento filho <simpleType>!`)

  // verificar se o nome do novo tipo já existe e adicioná-lo à lista de nomes respetiva caso seja único
  function newLocalType(name, kind) {
    if (Object.values(local_types).flat().includes(name)) return error("Já existe um simpleType/complexType com este nome nesta schema!")
    local_types[kind].push(name)
    current_type = name
    return true
  }
  
  // validar os atributos de um elemento <simpleType>/<complexType>
  function check_localTypeAttrs(arr, el_name) {
    let keys = getAttrsKeys(arr, el_name) // array com os nomes dos atributos

    // restrições relativas à profundidade dos elementos
    if (atRoot() && !keys.includes("name")) return error(`O atributo 'name' é requirido se o pai do elemento <${el_name}> for o <schema>!`)
    if (!atRoot() && keys.includes("name")) return error(`O atributo 'name' é proibido se o pai do elemento <${el_name}> não for o <schema>!`)

    if (el_name == "complexType") {
      // atributos com valores predefinidos
      if (!keys.includes("abstract")) arr.push({attr: "abstract", val: false})
      if (!keys.includes("mixed")) arr.push({attr: "mixed", val: false})
    }

    return arr
  }

  // validar o tipo de um elemento de derivação - tem de ter ou o atributo de referência ou um elemento filho <simpleType>
  function check_derivingType(elem, attr, attrs, content) {
    if (attr in attrs && content.some(x => x.element === "simpleType"))
      return error(`A utilização do elemento filho <simpleType> e do atributo "${attr}" é mutualmente exclusiva no elemento <${elem}>!`)
    if (!(attr in attrs) && !content.length)
      return error(`Um elemento <${elem}> deve ter o atributo "${attr}" ou um elemento filho <simpleType> para indicar o tipo a derivar!`)
    return true
  }

  // verificar que o nome do elemento de derivação, os atributos e o valor batem todos certo
  function check_constrFacetAttrs(name, arr) {
    let keys = [] // array com os nomes dos atributos
        
    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos
      if (keys.includes(arr[i].attr)) return error(`O elemento <${name}> não pode possuir atributos repetidos!`)
      else {
        keys.push(arr[i].attr)

        if (arr[i].attr == "value") {
          // restrições relativas ao conteúdo dos atributos
          if (name == "whiteSpace") {
            if (!["preserve","replace","collapse"].includes(arr[i].val)) return error(`O valor do atributo "value" do elemento <whiteSpace> deve ser um dos seguintes: {preserve, replace, collapse}!`)
          } 
          else if (name == "totalDigits") {
            if (!/[1-9]\d*/.test(arr[i].val)) return error(`O valor do atributo "totalDigits" deve ser um inteiro positivo!`)
            arr[i].val = parseInt(arr[i].val)
          } 
          else if (!(name == "pattern" || name == "enumeration")) {
            if (!/\d+/.test(arr[i].val)) return error(`O valor do atributo "value" do elemento <${name}> deve ser um inteiro não negativo!`)
            arr[i].val = parseInt(arr[i].val)
          }
        }
      }
    }

    // restrições relativas à existência dos atributos
    if (!keys.includes("value")) return error(`No elemento <${name}> é requirido o atributo "value"!`)
    if (name == "pattern" || name == "enumeration") {
      if (keys.includes("fixed")) return error(`O elemento <${name}> não aceita o atributo "fixed"!`)
    }
    else if (!keys.includes("fixed")) arr.push({attr: "fixed", val: false})

    return arr
  }

  // verifica se os valores do elemento de restrição dado e de enumeração se contradizem
  function contradictoryFacets(obj, facet, func) {
    if (facet in obj && "enumeration" in obj) {
      let vals = obj.enumeration.filter(func)
      if (vals.length > 0) return error(`O valor '${vals[0]}' do atributo "enumeration" contradiz o valor do atributo "${facet}"!`)
    }
    return true
  }

  // conta o número de casas decimais de um float
  function precision(a) {
    if (!isFinite(a)) return 0
    var e = 1, p = 0
    while (Math.round(a*e) / e !== a) { e *= 10; p++ }
    return p
  }

  function check_restrictionST_facets(arr) {
    let f = {pattern: [], enumeration: []} // objeto com os pares chave-valor
        
    for (let i = 0; i < arr.length; i++) {
      let key = arr[i].element,
          value = arr[i].attrs.filter(x => x.attr === "value")[0].val
      
      // só os atributos "pattern" e "enumeration" é que podem aparecer várias vezes
      if (!(key == "pattern" || key == "enumeration") && key in f) return error(`O atributo "${key}" só pode ser definido uma vez em cada elemento <${name}>!`)
      else {
        if (key == "pattern" || key == "enumeration") f[key].push(value)
        else f[key] = value
      }
    }

    // se não houver elementos "pattern" ou "enumeration", apagar essas chaves do objeto
    if (!f.enumeration.length) delete f.enumeration
    if (!f.pattern.length) delete f.pattern
    else f.pattern = f.pattern.join("|") // se houver vários patterns no mesmo passo de derivação, são ORed juntos
    
    let err1 = (a1,a2,e) => error(`Num elemento <restriction>, o valor do atributo "${a1}" não pode ser superior${e?" ou igual":""} ao do "${a2}"!`)
    let err2 = (a1,a2) => error(`Não pode especificar ambos os atributos "${a1}" e "${a2}" no mesmo passo de derivação!`)
    
    // restrições relativas a colisões entre os valores de atributos diretamente relacionados
    if ("length" in f) {
      if ("minLength" in f && f.minLength > f.length) return err1("minLength", "length", false)
      if ("maxLength" in f && f.maxLength < f.length) return err1("length", "maxLength", false)
    }
    if ("minLength" in f && "maxLength" in f && f.minLength > f.maxLength) return err1("minLength", "maxLength", false)
    if ("minInclusive" in f && "maxInclusive" in f && f.minInclusive > f.maxInclusive) return err1("minInclusive", "maxInclusive", false)
    if ("minExclusive" in f && "maxExclusive" in f && f.minExclusive > f.maxExclusive) return err1("minExclusive", "maxExclusive", false)
    if ("minExclusive" in f && "maxInclusive" in f && f.minExclusive >= f.maxInclusive) return err1("minExclusive", "maxInclusive", true)
    if ("minInclusive" in f && "maxExclusive" in f && f.minInclusive >= f.maxExclusive) return err1("minInclusive", "maxExclusive", true)
    if ("totalDigits" in f && "fractionDigits" in f && f.fractionDigits > f.totalDigits) return err1("fractionDigits", "totalDigits", false)

    // restrições relativas a colisões entre os valores de atributos indiretamente relacionados
    let result
    if ((result = contradictoryFacets(f, "length", x => x.length != f.length)) !== true) return result
    if ((result = contradictoryFacets(f, "minLength", x => x.length < f.minLength)) !== true) return result
    if ((result = contradictoryFacets(f, "maxLength", x => x.length > f.maxLength)) !== true) return result
    if ((result = contradictoryFacets(f, "totalDigits", x => x.replace(/^0+/,'').replace(/0+$/,'').length > f.totalDigits)) !== true) return result
    if ((result = contradictoryFacets(f, "fractionDigits", x => precision(parseFloat(x)) > f.fractionDigits)) !== true) return result
 
    // atributos mutuamente exclusivos
    if ("maxInclusive" in f && "maxExclusive" in f) return err2("maxInclusive", "maxExclusive")
    if ("minInclusive" in f && "minExclusive" in f) return err2("minInclusive", "minExclusive")

    return true
  }
}

DSL_text = ws XML_declaration ws xsd:schema { return xsd }


// ----- Declaração XML -----

XML_declaration = "<?xml" XML_version XML_encoding? XML_standalone? ws '?>'

XML_version = ws2 "version" ws "=" ws q1:QM "1.0" q2:QM &{return checkQM(q1,q2)}

XML_encoding = ws2 "encoding" ws "=" ws q1:QM XML_encoding_value q2:QM &{return checkQM(q1,q2)}
XML_encoding_value = "UTF-"("8"/"16") / "ISO-10646-UCS-"("2"/"4") / "ISO-8859-"[1-9] / "ISO-2022-JP" / "Shift_JIS" / "EUC-JP"

XML_standalone = ws2 "standalone" ws "=" ws q1:QM XML_standalone_value q2:QM &{return checkQM(q1,q2)}
XML_standalone_value = "yes" / "no"

// ----- <schema> -----

schema = (p:open_XSD_el {default_prefix = p}) "schema" attrs:schema_attrs ws ">" ws content:schema_content close_schema
         {return {element: "schema", attrs, content}}

close_schema = prefix:close_XSD_prefix "schema" ws ">" ws &{
  if (!noSchemaPrefix() && prefix === null) return error("Precisa de prefixar o elemento de fecho da schema!")
  if (noSchemaPrefix() && prefix !== null) return error("Não pode usar um prefixo aqui porque não predefiniu um prefixo para o namespace da schema!")
  if (prefix !== default_prefix) return error ("Precisa de prefixar o elemento de fecho da schema com o prefixo predefinido do seu namespace!")
  return true
}

schema_attrs = el:(formDefault / blockDefault / finalDefault / namespace /
                     elem_id / elem_lang / schema_version / targetNamespace)+ &{return check_schemaAttrs(el)} {return check_schemaAttrs(el)}

formDefault = ws2 attr:$(("attribute"/"element")"FormDefault") ws "=" ws q1:QM val:form_values q2:QM &{return checkQM(q1,q2)} {return {attr, val}}
blockDefault = ws2 "blockDefault" ws "=" ws q1:QM val:elem_block_values q2:QM                        &{return checkQM(q1,q2)} {return {attr: "blockDefault", val}}
finalDefault = ws2 "finalDefault" ws "=" ws q1:QM val:finalDefault_values q2:QM                      &{return checkQM(q1,q2)} {return {attr: "finalDefault", val}}
namespace = ws2 "xmlns" prefix:(":" p:NCName {return p})? ws "=" ws val:string                                                {prefixes.push(prefix); return {attr: "namespace", prefix, val}}
schema_version = ws2 "version" ws "=" ws val:string                                                                           {return {attr: "version", val: val.trim().replace(/[\t\n\r]/g," ").replace(/ +/g," ")}} // o valor da versão é um xs:token, que remove todos os \t\n\r da string, colapsa os espaços e dá trim à string
targetNamespace = ws2 "targetNamespace" ws "=" ws val:string                                                                  {return {attr: "targetNamespace", val}}

schema_content = el:(/* redefine / */ include / import / annotation)* (((simpleType /* / complexType / group / attributeGroup */) / element / attribute / notation ) annotation*)*
                 &{return validateLocalAttrs("schema", cleanContent(el))} {return el}


// ----- <include> -----

include = prefix:open_XSD_el el_name:"include" attrs:include_attrs ws close:(merged_close / ann_content)
          &{return check_elTags(el_name, prefix, close)}
          {return {element: el_name, attrs, content: close.content}}

include_attrs = attrs:(schemaLocation elem_id? / elem_id schemaLocation?)? 
                &{return (attrs!==null && cleanContent(attrs).some(x => x.attr === "schemaLocation")) ? true : error(`Um elemento <include> requer o atributo "schemaLocation"!`)}
                {return cleanContent(attrs)}

schemaLocation = ws2 "schemaLocation" ws "=" ws val:string {return {attr: "schemaLocation", val}}


// ----- <import> -----

import = prefix:open_XSD_el el_name:"import" attrs:import_attrs ws close:(merged_close / ann_content)
          &{return check_elTags(el_name, prefix, close)}
          {return {element: el_name, attrs, content: close.content}}

import_attrs = el:(namespace / elem_id / schemaLocation)* &{return check_importAttrs(el)} {return el}


// ----- <element> -----

element = prefix:open_XSD_el el_name:"element" attrs:element_attrs ws
          close:(merged_close / openEl content:element_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) &{
  if ((close.merged || !close.content.length) && !validateLocalEl(getAttrs(attrs))) return error("Um elemento local deve ter, pelo menos, o atributo 'name' ou 'ref'!")
  return check_elTags(el_name, prefix, close) && check_elemMutex(getAttrs(attrs), close.content)
} {return {element: el_name, attrs, content: close.content}}

element_attrs = el:(elem_abstract / elem_block / elem_default / elem_substitutionGroup /
                elem_final / elem_fixed / elem_form / elem_id / elem_minOccurs /
                elem_maxOccurs / elem_name / elem_nillable / elem_ref / elem_type)* &{return check_elemAttrs(el)} {return el}

elem_abstract = ws2 "abstract" ws "=" ws q1:QM val:boolean q2:QM                 &{return checkQM(q1,q2)}                                {return {attr: "abstract", val}}
elem_block = ws2 "block" ws "=" ws q1:QM val:elem_block_values q2:QM             &{return checkQM(q1,q2)}                                {return {attr: "block", val}}
elem_default = ws2 "default" ws "=" ws val:string                                                                                        {return {attr: "default", val}}
elem_final = ws2 "final" ws "=" ws q1:QM val:elem_final_values q2:QM             &{return checkQM(q1,q2)}                                {return {attr: "final", val}}
elem_fixed = ws2 "fixed" ws "=" ws val:string                                                                                            {return {attr: "fixed", val}}
elem_form = ws2 "form" ws "=" ws q1:QM val:form_values q2:QM                     &{return checkQM(q1,q2)}                                {return {attr: "form", val}}
elem_id = ws2 "id" ws "=" ws q1:QM val:ID q2:QM                                  &{return checkQM(q1,q2)}                                {return {attr: "id", val}}
elem_maxOccurs = ws2 "maxOccurs" ws "=" ws q1:QM val:(int/"unbounded") q2:QM     &{return checkQM(q1,q2)}                                {return {attr: "maxOccurs", val}}
elem_minOccurs = ws2 "minOccurs" ws "=" ws q1:QM val:int q2:QM                   &{return checkQM(q1,q2)}                                {return {attr: "minOccurs", val}}
elem_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM                          &{return checkQM(q1,q2) && validateName(val,"element")} {return {attr: "name", val}}
elem_nillable = ws2 "nillable" ws "=" ws q1:QM val:boolean q2:QM                 &{return checkQM(q1,q2)}                                {return {attr: "nillable", val}}
elem_lang = ws2 "xml:lang" ws "=" ws q1:QM val:language q2:QM                    &{return checkQM(q1,q2)}                                {return {attr: "lang", val}}
elem_ref = ws2 "ref" ws "=" ws q1:QM val:QName q2:QM                             &{return checkQM(q1,q2) && validateRef(val,"element")}  {return {attr: "ref", val}}
elem_source = ws2 "source" ws "=" ws val:string                                                                                          {return {attr: "source", val}}
elem_substitutionGroup = ws2 "substitutionGroup" ws "=" ws q1:QM val:QName q2:QM &{return checkQM(q1,q2)}                                {return {attr: "substitutionGroup", val}}
elem_type = ws2 "type" ws "=" ws q1:QM val:type_value q2:QM                      &{return checkQM(q1,q2)}                                {return {attr: "type", val}}

element_content = c:(annotation? (simpleType /* / complexType */)? /* (unique / key / keyref)*) */) {return cleanContent(c)}


// ----- <attribute> -----

attribute = prefix:open_XSD_el el_name:$("attribute" {any_type = false}) attrs:attribute_attrs ws
            close:(merged_close / openEl content:attribute_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) &{
  if ((close.merged || !close.content.length) && !validateLocalEl(getAttrs(attrs))) return error("Um atributo local deve ter, pelo menos, o atributo 'name' ou 'ref'!")
  return check_elTags(el_name, prefix, close) && check_attrMutex(getAttrs(attrs), close.content)
} {return {element: el_name, attrs, content: close.content}}

attribute_attrs = el:(elem_default / elem_fixed / elem_form / elem_id / attr_name / attr_ref / elem_type / attr_use)* &{return check_attributeAttrs(el)} {any_type = true; return el}

attr_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM        &{return checkQM(q1,q2) && validateName(val,"attribute")} {return {attr: "name", val}}
attr_ref = ws2 "ref" ws "=" ws q1:QM val:QName q2:QM           &{return checkQM(q1,q2) && validateRef(val,"attribute")}  {return {attr: "ref", val}}
attr_use = ws2 "use" ws "=" ws q1:QM val:attr_use_values q2:QM &{return checkQM(q1,q2)}                                  {return {attr: "use", val}}

attribute_content = c:(annotation? simpleType?) {return cleanContent(c)}


// ----- <simpleType> -----

simpleType = prefix:open_XSD_el el_name:"simpleType" attrs:simpleType_attrs ws (openEl {type_depth++}) ws content:simpleType_content close_el:close_XSD_el
             &{return check_elTags(el_name, prefix, {merged: false, ...close_el})}
             {if (!--type_depth) current_type = null; return {element: el_name, attrs, content}}

simpleType_attrs = el:(simpleType_final / elem_id / simpleType_name)* &{return check_localTypeAttrs(el, "simpleType")} {return el}

simpleType_final = ws2 "final" ws "=" ws q1:QM val:simpleType_final_values q2:QM &{return checkQM(q1,q2)}                               {return {attr: "final", val}}
simpleType_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM                    &{return checkQM(q1,q2) && newLocalType(val,"simple")} {return {attr: "name", val}}

simpleType_content = c:(annotation? (restrictionST / list / union)) {return cleanContent(c)}


// ----- <annotation> -----

annotation = prefix:open_XSD_el el_name:"annotation" attr:elem_id? ws
             close:(merged_close / openEl content:annotation_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
             &{return check_elTags(el_name, prefix, close)}
             {return {element: el_name, attrs: cleanContent(attr), content}}

annotation_content = (appinfo / documentation)*


// ----- <appinfo> -----

appinfo = appinfo_simple / appinfo_prefix

appinfo_simple = "<appinfo" attr:elem_source? ws
                 close:("/>" ws {return ""} / openEl content:appinfo_content_simple? close_appinfo_simple {return content===null ? "" : content})
                 {return {element: "appinfo", attrs: cleanContent(attr), content: close}}

appinfo_prefix = prefix:open_XSD_el el_name:"appinfo" attr:elem_source? ws
                 close:(merged_close / openEl content:appinfo_content_prefix? close_el:close_appinfo_prefix {return {merged: false, ...close_el, content}})
                 &{return check_elTags(el_name, prefix, close)} 
                 {return {element: el_name, attrs: cleanContent(attr), content: (close.content === [] || close.content === null) ? "" : close.content}}

appinfo_content_simple = (!close_appinfo_simple). appinfo_content_simple* {return text().trim()}
appinfo_content_prefix = (!close_appinfo_prefix). appinfo_content_prefix* {return text().trim()}

close_appinfo_simple = "</appinfo" ws closeEl
close_appinfo_prefix = prefix:close_XSD_prefix name:"appinfo" ws closeEl {return {name, prefix}}


// ----- <documentation> -----

documentation = doc_simple / doc_prefix

documentation_attrs = attrs:(elem_source elem_lang? / elem_lang elem_source?)? {return cleanContent(attrs)}

doc_simple = "<documentation" attrs:documentation_attrs ws
             close:("/>" ws {return ""} / openEl content:doc_content_simple? close_doc_simple {return content===null ? "" : content})
             {return {element: "documentation", attrs, content: close}}

doc_prefix = prefix:open_XSD_el el_name:"documentation" attrs:documentation_attrs ws 
             close:(merged_close / openEl content:doc_content_prefix? close_el:close_doc_prefix {return {merged: false, ...close_el, content}})
             &{return check_elTags(el_name, prefix, close)}
             {return {element: el_name, attrs, content: (close.content===[] || close.content===null) ? "" : close.content}}

doc_content_prefix = (!close_doc_prefix). doc_content_prefix* {return text().trim()}
doc_content_simple = (!close_doc_simple). doc_content_simple* {return text().trim()}

close_doc_simple = "</documentation" ws closeEl
close_doc_prefix = prefix:close_XSD_prefix name:"documentation" ws closeEl {return {name, prefix}}


// ----- <union> -----

union = prefix:open_XSD_el el_name:"union" attrs:union_attrs ws 
        close:(merged_close / openEl content:union_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
        &{return check_elTags(el_name, prefix, close) && validateUnion(getAttrs(attrs), close.content)}
        {return {element: el_name, attrs, content}}

union_attrs = attrs:(elem_id union_memberTypes? / union_memberTypes elem_id?)? {return cleanContent(attrs)}

union_memberTypes = ws2 ("memberTypes" {any_type = false}) ws "=" ws q1:QM val:list_types q2:QM
                    &{return checkQM(q1,q2)} {any_type = true; return {attr: "memberTypes", val}}

union_content = fst:annotation? others:simpleType* {if (fst !== null) others.unshift(fst); return others}


// ----- <list> -----

list = prefix:open_XSD_el el_name:"list" attrs:list_attrs ws 
       close:(merged_close / openEl content:list_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
       &{return check_elTags(el_name, prefix, close) && check_derivingType(el_name, "itemType", getAttrs(attrs), close.content)}
       {return {element: el_name, attrs, content: close.content}}

list_attrs = attrs:(elem_id list_itemType? / list_itemType elem_id?)? {return cleanContent(attrs)}

list_itemType = ws2 ("itemType" {any_type = false}) ws "=" ws q1:QM val:type_value q2:QM
                &{return checkQM(q1,q2)} {any_type = true; return {attr: "itemType", val}}

list_content = c:(annotation? simpleType?) {return cleanContent(c)}


// ----- <restriction> (simpleType) -----

restrictionST = prefix:open_XSD_el el_name:"restriction" attrs:restrictionST_attrs ws 
                 close:(merged_close / openEl content:restrictionST_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
                 &{return check_elTags(el_name, prefix, close) && check_derivingType(el_name, "base", getAttrs(attrs), close.content)}
                 {return {element: el_name, attrs, content: close.content}}

restrictionST_attrs = attrs:(restrictionST_base elem_id? / elem_id restrictionST_base?)? {return cleanContent(attrs)}

restrictionST_base = ws2 ("base" {any_type = false}) ws "=" ws q1:QM val:type_value q2:QM &{return checkQM(q1,q2)} {any_type = true; return {attr: "base", val}}
                     
restrictionST_content = fst:annotation? snd:simpleType? others:constrFacet* &{return check_restrictionST_facets(others)} {return cleanContent([fst, snd, ...others])}


constrFacet = prefix:open_XSD_el el_name:constrFacet_values 
              attrs:(a:constrFacet_attrs ws &{return check_constrFacetAttrs(el_name, a)} {return check_constrFacetAttrs(el_name, a)})
              close:(merged_close / ann_content)
              &{return check_elTags(el_name, prefix, close)}
              {return {element: el_name, attrs, content: close.content}}

constrFacet_attrs = el:(elem_id / constrFacet_fixed / constrFacet_value)* {return el}

constrFacet_fixed = ws2 "fixed" ws "=" ws q1:QM val:boolean q2:QM &{return checkQM(q1,q2)} {return {attr: "fixed", val}}
constrFacet_value = ws2 "value" ws "=" ws val:string                                       {return {attr: "value", val}}


// ----- <complexType> -----

complexType = prefix:open_XSD_el el_name:"complexType" attrs:complexType_attrs ws 
              close:(merged_close / (openEl {type_depth++}) /* content:complexType_content */ close_el:close_XSD_el {return {merged: false, ...close_el, content}})
              &{return check_elTags(el_name, prefix, close)}
              {return {element: "complexType", attrs, content: close.content}}

complexType_attrs = el:(elem_abstract / complexType_block / elem_final / elem_id / complexType_mixed)
                    &{return check_localTypeAttrs(el, "complexType")} {return check_localTypeAttrs(el, "complexType")}

complexType_block = ws2 "block" ws "=" ws q1:QM val:elem_final_values q2:QM &{return checkQM(q1,q2)}                                {return {attr: "block", val}}
complexType_mixed = ws2 "mixed" ws "=" ws q1:QM val:boolean q2:QM           &{return checkQM(q1,q2)}                                {return {attr: "mixed", val}}
complexType_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM              &{return checkQM(q1,q2) && newLocalType(val,"complex")} {return {attr: "name", val}}


// ----- <notation> -----

notation = prefix:open_XSD_el el_name:"notation" attrs:notation_attrs ws close:(merged_close / ann_content)
          &{return check_elTags(el_name, prefix, close)}
          {return {element: "notation", attrs, content: close.content}}

notation_attrs = el:(elem_id / notation_name / notation_URI_attrs)* &{return check_notationAttrs(el)} {return el}

notation_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM              &{return checkQM(q1,q2) && validateName(val,"notation")} {return {attr: "name", val}}
notation_URI_attrs = ws2 attr:("public" / "system") ws "=" ws val:string                                                          {return {attr, val}}


// ----- Regex recorrentes -----

openEl  = ">" ws {schema_depth++}
closeEl = ">" ws {schema_depth--}

open_XSD_el      = "<"  prefix:(p:NCName ":" {return p})? {return prefix}
close_XSD_prefix = "</" prefix:(p:NCName ":" {return p})? {return prefix}

close_XSD_el = prefix:close_XSD_prefix name:XSD_el_name ws closeEl {return {name, prefix}}
ann_content = openEl content:annotation? close_el:close_XSD_el {return {merged: false, ...close_el, content: cleanContent(content)}}

merged_close = "/>" ws {return {merged: true, content: []}}


// ----- Valores -----

ws "whitespace" = [ \t\n\r]*
ws2 = [ \t\n\r]+
QM = '"' / "'"

boolean = true / false
false = "false" { return false }
true  = "true"  { return true }
null  = "null"  { return null }

int = integer:(("0"* i:([1-9] [0-9]*) {return i}) / (i:"0" "0"* {return i})) {return parseInt(Array.isArray(integer) ? integer.flat().join("") : integer)}

letter = [a-zA-Z]
letter1_8 = $(letter letter? letter? letter? letter? letter? letter? letter?)
string = '"'v:[^"]*'"' {return v.join("")} / "'"v:[^']*"'" {return v.join("")}

NCName = $(([a-zA-Z_]/[^\x00-\x7F])([a-zA-Z0-9.\-_]/[^\x00-\x7F])*)
QName = $((p:NCName ":" &{return existsPrefix(p)})? NCName)
ID = id:NCName &{return validateID(id)} {ids.push(id); return id}
language = $((letter letter / [iI]"-"letter+ / [xX]"-"letter1_8)("-"letter1_8)?)

XSD_el_name = "include" / "import" / "element" / "attribute" / 
              "simpleType" / "annotation" / "appinfo" / "documentation" / "union" / "list" / "restriction" / "notation" / constrFacet_values /
              "complexType"

form_values = $("un"?"qualified")
elem_final_values = "#all" / "extension" / "restriction"
elem_block_values = elem_final_values / "substitution"
finalDefault_values = elem_final_values / "list" / "union"
simpleType_final_values = "#all" / "list" / "union" / "restriction"
attr_use_values = "optional" / "prohibited" / "required"
constrFacet_values = $("length" / ("max"/"min")"Length" / ("max"/"min")("Ex"/"In")"clusive" / ("total"/"fraction")"Digits" / "whiteSpace" / "pattern" / "enumeration")

// um tipo válido tem de ser um dos seguintes: tipo built-in (com ou sem prefixo da schema); tipo de outra schema importada, com o prefixo respetivo; simple/complexType local
type_value = $(prefix:(p:NCName ":" {return p})? type:$(elem_primitive_types / elem_derived_types) &{
  return prefix === default_prefix ? true : error(`Para especificar um dos tipos embutidos de schemas XML, tem de o prefixar com o prefixo do namespace desta schema.${(noSchemaPrefix() && prefix !== null) ? " Neste caso, como não declarou um prefixo para o namespace da schema, não deve prefixar o tipo também." : ""}`)
} / p:NCName ":" name:NCName &{return existsPrefix(p) && (p !== default_prefix || validateLocalType(name))} // se for o prefixo desta schema, verifica-se que o tipo existe; se não for, assume-se que sim
  / name:NCName &{return validateLocalType(name)})

elem_primitive_types = "string"/"boolean"/"decimal"/"float"/"double"/"duration"/"dateTime"/"time"/"date"/"gYearMonth"/"gYear"/"gMonthDay"/"gDay"/"gMonth"/"hexBinary"/"base64Binary"/"anyURI"/"QName"/"NOTATION"
elem_derived_types = "normalizedString"/"token"/"language"/"NMTOKEN"/"NMTOKENS"/"Name"/"NCName"/"ID"/"IDREF"/"IDREFS"/"ENTITY"/"ENTITIES"/"integer"/"nonPositiveInteger"/"negativeInteger"/"long"/"int"/"short"/"byte"/"nonNegativeInteger"/"unsignedLong"/"unsignedInt"/"unsignedShort"/"unsignedByte"/"positiveInteger"

list_types = fst:type_value? others:(ws2 n:type_value {return n})* ws {if (fst !== null) others.unshift(fst); return others}