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

  // nomes dos elementos globais declarados na schema, para verificar a validade dos atributos "ref"
  let global_elems = []
  // nomes dos elementos <notation>
  let notation_names = []
  // atributos "id" de elementos da schema - têm de ser únicos
  let elem_ids = []

  // validar um elemento básico (sem simple/complexType) - verificar que tem os atributos essenciais
  const validateBasicElement = attrs => "ref" in attrs || "name" in attrs
  // verificar se o novo id é único na schema
  const validateID = id => !elem_ids.includes(id) ? true : error("O valor do atributo 'id' deve ser único!")
  // validar se o atributo "ref" está a referenciar um elemento global válido da schema ou de uma schema importada (só se valida o prefixo, neste caso)
  const validateRef = ref => (ref.includes(":") || global_elems.includes(ref)) ? true : error("Está a tentar referenciar um elemento inexistente! Só é possível referenciar elementos globais.")
  // para elementos com 1 só atributo possível, retorna um array com ou sem ele, conforme seja null ou não
  const isNullAttr = attr => attr === null ? [] : [attr]
  // remove os nulls que vierem na lista de filhos de um elemento
  const cleanContent = content => content.filter(e => e !== null)
  // validar o nome de um <element> - se for um elemento global, o nome deve ser único
  const validateElemName = name => {
    if (atRoot() && !global_elems.includes(name)) {global_elems.push(name); return true}
    return error("Todos os elementos <element> definidos globalmente devem ter nomes únicos!")
  }
  // validar o nome de um <notation> - deve ser único
  const validateNotationName = name => {
    if (notation_names.includes(name)) return error("Todos os elementos <notation> devem ter nomes únicos!")
    notation_names.push(name); return true
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
      if (keys.includes("ref")) return error("O atributo 'ref' é proibido num elemento de schema!")
      if (keys.includes("maxOccurs")) return error("O atributo 'maxOccurs' é proibido num elemento de schema!")
      if (keys.includes("minOccurs")) return error("O atributo 'minOccurs' é proibido num elemento de schema!")
      if (!keys.includes("name")) return error("O atributo 'name' é requirido num elemento de schema!")
    }
    // elementos aninhados
    else if (keys.includes("final")) return error("O atributo 'final' é proibido num elemento aninhado!")

    // mensagem de erro de atributos mutuamente exclusivos
    let mutexc_error = (a1,a2) => error(`Os atributos '${a1}' e '${a2}' são mutuamente exclusivos!`)
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
      return error("A propriedade 'maxOccurs' do elemento não pode ser inferior à 'minOccurs'!")

    // atributos com valores predefinidos
    if (!keys.includes("abstract")) arr.push({attr: "abstract", val: false})
    //if (!keys.includes("form")) attrs.form = //valor do atributo elementFormDefault do elemento da schema
    if (!keys.includes("nillable")) arr.push({attr: "nillable", val: false})

    return arr
  }

  // validar os prefixos de abertura e fecho de um elemento
  function check_elemPrefixes(merged, prefix, close_prefix, elem_name) {
    // merged é um boleano que indica se a abertura e fecho são feitos no mesmo elemento ou não
    if (!merged && prefix !== close_prefix) return error(`O prefixo do elemento de fecho do <${elem_name}> tem de ser igual ao prefixo do elemento de abertura!`)
    if (prefix !== null && prefix !== default_prefix) return error("Prefixo inválido!")
    if (prefix === null && !noSchemaPrefix()) return error("Precisa de prefixar o elemento com o prefixo do respetivo namespace!")
    return true
  }

  // validar os atributos de um elemento <notation>
  function check_notationAttrs(arr) {
    let keys = [] // array com os nomes dos atributos

    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos
      if (keys.includes(arr[i].attr)) return error("O elemento <notation> não pode possuir atributos repetidos!")
      else keys.push(arr[i].attr)
    }

    // restrições relativas à profundidade dos elementos
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
  const validateUnion = (attrs,content) => attrs.memberTypes.length + content.filter(e => e.element === "simpleType").length > 0 ? true : 
                                           error(`Um elemento <union> deve ter o atributo "memberTypes" não vazio ou pelo menos um elemento filho <simpleType>!`)
  // verificar se os nomes dos elementos de abertura e fecho de elementos de limites numéricos coincidem
  const checkConstraintNames = (merged, open, close) => (merged || open === close) ? true : error(`O nome do elemento de abertura (${open}) deve ser igual ao de fecho (${close})!`)

  // verificar se o nome do novo tipo já existe e adicioná-lo à lista de nomes caso seja único
  function newSimpleType(name) {
    if (local_types.simple.includes(name)) return error("Já existe um simpleType/complexType com este nome nesta schema!")
    local_types.simple.push(name)
    current_type = name
    return true
  }
  
  // validar os atributos de um elemento <simpleType>
  function check_simpleTypeAttrs(arr) {
    let keys = [] // array com os nomes dos atributos

    for (let i = 0; i < arr.length; i++) {
      // verificar que não há atributos repetidos
      if (keys.includes(arr[i].attr)) return error("O elemento <simpleType> não pode possuir atributos repetidos!")
      else keys.push(arr[i].attr)
    }

    // restrições relativas à profundidade dos elementos
    if (atRoot() && !keys.includes("name")) return error("O atributo 'name' é requirido se o pai do elemento <simpleType> for o <schema>!")
    if (!atRoot() && keys.includes("name")) return error("O atributo 'name' é proibido se o pai do elemento <simpleType> não for o <schema>!")

    return true
  }

  // validar o tipo de um elemento de derivação - tem de ter ou o atributo de referência ou um elemento filho <simpleType>
  function check_derivingType(elem, attr, attrs, content) {
    if (attr in attrs && content !== null && content.some(x => x.element === "simpleType"))
      return error(`A utilização do elemento filho <simpleType> e do atributo "${attr}" é mutualmente exclusiva no elemento <${elem}>!`)
    if (!(attr in attrs) && content === null)
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

schema = "<" (p:NCName ":" {default_prefix = p})? "schema" attrs:schema_attrs ws ">" ws content:schema_content end_schema {return {element: "schema", attrs, content}}

end_schema = "</" prefix:(p:NCName ":" {return p})? "schema" ws ">" ws &{
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

schema_content = (/* redefine / */ include / import / annotation)* (((simpleType /* / complexType / group / attributeGroup */) / element /* / attribute*/ / notation ) annotation*)*


// ----- <include> -----

include = "<" prefix:(p:NCName ":" {return p})? "include" attrs:include_attrs ws 
          close:("/>" ws {return {basic: true, content: []}} / 
                openEl ws content:annotation? close_data:close_include {return {basic: false, close_prefix, content: content===null ? [] : content}})
          &{return check_elemPrefixes(close.basic, prefix, close.close_prefix, "include")}
          {return {element: "include", attrs, content: close.content}}

close_include = "</" close_prefix:(p:NCName ":" {return p})? "include" ws closeEl ws {return close_prefix}

include_attrs = attrs:(schemaLocation elem_id? / elem_id schemaLocation?)? 
                &{return (attrs!==null && cleanContent(attrs).some(x => x.attr === "schemaLocation")) ? true : error(`Um elemento <include> requer o atributo "schemaLocation"!`)}
                {return attrs===null ? [] : cleanContent(attrs)}

schemaLocation = ws2 "schemaLocation" ws "=" ws val:string {return {attr: "schemaLocation", val}}


// ----- <import> -----

import = "<" prefix:(p:NCName ":" {return p})? "import" attrs:import_attrs ws 
          close:("/>" ws {return {basic: true, content: []}} / 
                openEl ws content:annotation? close_data:close_import {return {basic: false, close_prefix, content: content===null ? [] : content}})
          &{return check_elemPrefixes(close.basic, prefix, close.close_prefix, "import")}
          {return {element: "import", attrs, content: close.content}}

close_import = "</" close_prefix:(p:NCName ":" {return p})? "import" ws closeEl ws {return close_prefix}

import_attrs = el:(namespace / elem_id / schemaLocation)* &{return check_importAttrs(el)} {return el}


// ----- <element> -----

element = "<" prefix:(p:NCName ":" {return p})? "element" attrs:element_attrs ws
          close:("/>" ws {return {basic: true, content: []}} / 
                openEl ws content:element_content close_prefix:close_element {return {basic: false, close_prefix, content}}) &{
  if ((close.basic || !close.content.length) && !validateBasicElement(getAttrs(attrs))) return error("Um elemento básico deve ter, pelo menos, o atributo 'name' ou 'ref'!")
  return check_elemPrefixes(close.basic, prefix, close.close_prefix, "element")
} {return {element: "element", attrs, content: close.content}}

close_element = "</" prefix:(p:NCName ":" {return p})? "element" ws closeEl ws {return prefix}

element_attrs = el:(elem_abstract / elem_block / elem_default / elem_substitutionGroup /
                elem_final / elem_fixed / elem_form / elem_id / elem_minOccurs /
                elem_maxOccurs / elem_name / elem_nillable / elem_ref / elem_type)+ &{return check_elemAttrs(el)} {return el}

elem_abstract = ws2 "abstract" ws "=" ws q1:QM val:boolean q2:QM                 &{return checkQM(q1,q2)}                          {return {attr: "abstract", val}}
elem_block = ws2 "block" ws "=" ws q1:QM val:elem_block_values q2:QM             &{return checkQM(q1,q2)}                          {return {attr: "block", val}}
elem_default = ws2 "default" ws "=" ws val:string                                                                                  {return {attr: "default", val}}
elem_final = ws2 "final" ws "=" ws q1:QM val:elem_final_values q2:QM             &{return checkQM(q1,q2)}                          {return {attr: "final", val}}
elem_fixed = ws2 "fixed" ws "=" ws val:string                                                                                      {return {attr: "fixed", val}}
elem_form = ws2 "form" ws "=" ws q1:QM val:form_values q2:QM                     &{return checkQM(q1,q2)}                          {return {attr: "form", val}}
elem_id = ws2 "id" ws "=" ws q1:QM val:ID q2:QM                                  &{return checkQM(q1,q2)}                          {return {attr: "id", val}}
elem_maxOccurs = ws2 "maxOccurs" ws "=" ws q1:QM val:(int/"unbounded") q2:QM     &{return checkQM(q1,q2)}                          {return {attr: "maxOccurs", val}}
elem_minOccurs = ws2 "minOccurs" ws "=" ws q1:QM val:int q2:QM                   &{return checkQM(q1,q2)}                          {return {attr: "minOccurs", val}}
elem_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM                          &{return checkQM(q1,q2) && validateElemName(val)} {return {attr: "name", val}}
elem_nillable = ws2 "nillable" ws "=" ws q1:QM val:boolean q2:QM                 &{return checkQM(q1,q2)}                          {return {attr: "nillable", val}}
elem_lang = ws2 "xml:lang" ws "=" ws q1:QM val:language q2:QM                    &{return checkQM(q1,q2)}                          {return {attr: "lang", val}}
elem_ref = ws2 "ref" ws "=" ws q1:QM val:QName q2:QM                             &{return checkQM(q1,q2) && validateRef(val)}      {return {attr: "ref", val}}
elem_source = ws2 "source" ws "=" ws val:string                                                                                    {return {attr: "source", val}}
elem_substitutionGroup = ws2 "substitutionGroup" ws "=" ws q1:QM val:QName q2:QM &{return checkQM(q1,q2)}                          {return {attr: "substitutionGroup", val}}
elem_type = ws2 "type" ws "=" ws q1:QM val:type_value q2:QM                      &{return checkQM(q1,q2)}                          {return {attr: "type", val}}

element_content = c:(annotation? (simpleType /* / complexType */)? /* (unique / key / keyref)*) */) {return cleanContent(c)}


// ----- <simpleType> -----

simpleType = "<" prefix:(p:NCName ":" {return p})? "simpleType" attrs:simpleType_attrs ws (openEl {type_depth++}) ws content:simpleType_content
             "</" close_prefix:(p:NCName ":" {return p})? "simpleType" ws (closeEl {if (!--type_depth) current_type = null}) ws
             &{return check_elemPrefixes(false, prefix, close_prefix, "simpleType")} {return {element: "simpleType", attrs, content}}

simpleType_attrs = el:(simpleType_final / elem_id / simpleType_name)* &{return check_simpleTypeAttrs(el)} {return el}

simpleType_final = ws2 "final" ws "=" ws q1:QM val:simpleType_final_values q2:QM &{return checkQM(q1,q2)}                       {return {attr: "final", val}}
simpleType_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM                    &{return checkQM(q1,q2) && newSimpleType(val)} {return {attr: "name", val}}

simpleType_content = c:(annotation? (restrictionST / list / union)) {return cleanContent(c)}


// ----- <annotation> -----

annotation = "<" prefix:(p:NCName ":" {return p})? "annotation" attr:elem_id? ws openEl ws content:annotation_content
             "</" close_prefix:(p:NCName ":" {return p})? "annotation" ws closeEl ws
             &{return check_elemPrefixes(false, prefix, close_prefix, "annotation")} {return {element: "annotation", attrs: isNullAttr(attr), content}}

annotation_content = (appinfo / documentation)*


// ----- <appinfo> -----

appinfo = appinfo_simple / appinfo_prefix

appinfo_simple = "<appinfo" attr:elem_source? ws openEl content:appinfo_content_simple? close_appinfo_simple
                 {return {element: "appinfo", attrs: isNullAttr(attr), content: content===null ? "" : content}}

appinfo_prefix = "<" prefix:(p:NCName ":" {return p})? "appinfo" attr:elem_source? ws openEl content:appinfo_content_prefix? close_prefix:close_appinfo_prefix
                 &{return check_elemPrefixes(false, prefix, close_prefix, "appinfo")} 
                 {return {element: "appinfo", attrs: isNullAttr(attr), content}}

appinfo_content_simple = (!close_appinfo_simple). appinfo_content_simple* {return text().trim()}
appinfo_content_prefix = (!close_appinfo_prefix). appinfo_content_prefix* {return text().trim()}

close_appinfo_simple = "</appinfo" ws closeEl ws
close_appinfo_prefix = "</" close_prefix:(p:NCName ":" {return p})? "appinfo" ws closeEl ws {return close_prefix}


// ----- <documentation> -----

documentation = doc_simple / doc_prefix

documentation_attrs = attrs:(elem_source elem_lang? / elem_lang elem_source?)? {return attrs===null ? [] : cleanContent(attrs)}

doc_simple = "<documentation" attrs:documentation_attrs ws openEl content:doc_content_simple? close_doc_simple
             {return {element: "documentation", attrs, content: content===null ? "" : content}}

doc_prefix = "<" prefix:(p:NCName ":" {return p})? "documentation" attrs:documentation_attrs ws openEl content:doc_content_prefix? close_prefix:close_doc_prefix
             &{return check_elemPrefixes(false, prefix, close_prefix, "documentation")}
             {return {element: "documentation", attrs, content: content===null ? "" : content}}

doc_content_prefix = (!close_doc_prefix). doc_content_prefix* {return text().trim()}
doc_content_simple = (!close_doc_simple). doc_content_simple* {return text().trim()}

close_doc_simple = "</documentation" ws closeEl ws
close_doc_prefix = "</" close_prefix:(p:NCName ":" {return p})? "documentation" ws closeEl ws {return close_prefix}


// ----- <union> -----

union = "<" prefix:(p:NCName ":" {return p})? "union" attrs:union_attrs ws openEl ws content:union_content
        "</" close_prefix:(p:NCName ":" {return p})? "union" ws closeEl ws
        &{return check_elemPrefixes(false, prefix, close_prefix, "union") && validateUnion(getAttrs(attrs), content)}
        {return {element: "union", attrs, content}}

union_attrs = attrs:(elem_id union_memberTypes? / union_memberTypes elem_id?)? {return attrs===null ? [] : cleanContent(attrs)}

union_memberTypes = ws2 ("memberTypes" {any_type = false}) ws "=" ws q1:QM val:list_types q2:QM
                    &{return checkQM(q1,q2)} {any_type = true; return {attr: "memberTypes", val}}

union_content = fst:annotation? others:simpleType* {if (fst !== null) others.unshift(fst); return others}


// ----- <list> -----

list = "<" prefix:(p:NCName ":" {return p})? "list" attrs:list_attrs ws 
       close:("/>" ws {return {basic: true, content: []}} / 
              openEl ws content:list_content close_prefix:close_list {return {basic: false, close_prefix, content}})
       &{return check_elemPrefixes(close.basic, prefix, close.close_prefix, "list") && check_derivingType("list", "itemType", getAttrs(attrs), close.content)}
       {return {element: "list", attrs, content: close.content}}

close_list = "</" close_prefix:(p:NCName ":" {return p})? "list" ws closeEl ws {return close_prefix}

list_attrs = attrs:(elem_id list_itemType? / list_itemType elem_id?)? {return attrs===null ? [] : cleanContent(attrs)}

list_itemType = ws2 ("itemType" {any_type = false}) ws "=" ws q1:QM val:type_value q2:QM
                &{return checkQM(q1,q2)} {any_type = true; return {attr: "itemType", val}}

list_content = c:(annotation? simpleType?) {return cleanContent(c)}


// ----- <restriction> (simpleType) -----

restrictionST = "<" prefix:(p:NCName ":" {return p})? "restriction" attrs:restrictionST_attrs ws 
                 close:("/>" ws {return {basic: true, content: []}} / 
                        openEl ws content:restrictionST_content close_prefix:close_restrictionST {return {basic: false, close_prefix, content}})
                 &{return check_elemPrefixes(close.basic, prefix, close.close_prefix, "restrictionST") && check_derivingType("restriction", "base", getAttrs(attrs), close.content)}
                 {return {element: "restriction", attrs, content: close.content}}

close_restrictionST = "</" close_prefix:(p:NCName ":" {return p})? "restriction" ws closeEl ws {return close_prefix}

restrictionST_attrs = attrs:(restrictionST_base elem_id? / elem_id restrictionST_base?)? {return attrs===null ? [] : cleanContent(attrs)}

restrictionST_base = ws2 ("base" {any_type = false}) ws "=" ws q1:QM val:type_value q2:QM &{return checkQM(q1,q2)} {any_type = true; return {attr: "base", val}}
                     
restrictionST_content = fst:annotation? snd:simpleType? others:constrFacet* &{return check_restrictionST_facets(others)} {return cleanContent([fst, snd, ...others])}


constrFacet = "<" prefix:(p:NCName ":" {return p})? facet:constrFacet_values 
              attrs:(a:constrFacet_attrs ws &{return check_constrFacetAttrs(facet,a)} {return check_constrFacetAttrs(facet,a)})
              close:("/>" ws {return {basic: true, content: []}} / 
                    openEl ws content:annotation? close_data:close_constrFacet {return {basic: false, ...close_data, content: content===null ? [] : content}})
              &{return check_elemPrefixes(close.basic, prefix, close.close_prefix, facet) && checkConstraintNames(close.basic, facet, close.close_facet)}
              {return {element: facet, attrs, content: close.content}}

close_constrFacet = "</" close_prefix:(p:NCName ":" {return p})? close_facet:constrFacet_values ws closeEl ws {return {close_prefix, close_facet}}

constrFacet_attrs = el:(elem_id / constrFacet_fixed / constrFacet_value)+ {return el}

constrFacet_fixed = ws2 "fixed" ws "=" ws q1:QM val:boolean q2:QM &{return checkQM(q1,q2)} {return {attr: "fixed", val}}
constrFacet_value = ws2 "value" ws "=" ws val:string                                       {return {attr: "value", val}}


// ----- <notation> -----

notation = "<" prefix:(p:NCName ":" {return p})? "notation" attrs:notation_attrs ws 
          close:("/>" ws {return {basic: true, content: []}} / 
                openEl ws content:annotation? close_data:close_notation {return {basic: false, close_prefix, content: content===null ? [] : content}})
          &{return check_elemPrefixes(close.basic, prefix, close.close_prefix, "notation")}
          {return {element: "notation", attrs, content: close.content}}

close_notation = "</" close_prefix:(p:NCName ":" {return p})? "notation" ws closeEl ws {return close_prefix}

notation_attrs = el:(elem_id / notation_name / notation_URI_attrs)* &{return check_notationAttrs(el)} {return el}

notation_name = ws2 "name" ws "=" ws q1:QM val:NCName q2:QM              &{return checkQM(q1,q2) && validateNotationName(val)} {return {attr: "name", val}}
notation_URI_attrs = ws2 attr:("public" / "system") ws "=" ws val:string                                                       {return {attr, val}}


// ----- Valores -----

openEl  = ">" {schema_depth++}
closeEl = ">" {schema_depth--}

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
ID = id:NCName &{return validateID(id)} {elem_ids.push(id); return id}
language = $((letter letter / [iI]"-"letter+ / [xX]"-"letter1_8)("-"letter1_8)?)

form_values = $("un"?"qualified")
elem_final_values = "#all" / "extension" / "restriction"
elem_block_values = elem_final_values / "substitution"
finalDefault_values = elem_final_values / "list" / "union"
simpleType_final_values = "#all" / "list" / "union" / "restriction"
constrFacet_values = $("length" / ("max"/"min")"Length" / ("max"/"min")("Ex"/"In")"clusive" / ("total"/"fraction")"Digits" / "whiteSpace" / "pattern" / "enumeration")

// um tipo válido tem de ser um dos seguintes: tipo built-in (com ou sem prefixo da schema); tipo de outra schema importada, com o prefixo respetivo; simple/complexType local
type_value = $(prefix:(p:NCName ":" {return p})? type:$(elem_primitive_types / elem_derived_types) &{
  return prefix === default_prefix ? true : error(`Para especificar um dos tipos embutidos de schemas XML, tem de o prefixar com o prefixo do namespace desta schema.${(noSchemaPrefix() && prefix !== null) ? " Neste caso, como não declarou um prefixo para o namespace da schema, não deve prefixar o tipo também." : ""}`)
} / p:NCName ":" name:NCName &{return existsPrefix(p) && (p !== default_prefix || validateLocalType(name))} // se for o prefixo desta schema, verifica-se que o tipo existe; se não for, assume-se que sim
  / name:NCName &{return validateLocalType(name)})

elem_primitive_types = "string"/"boolean"/"decimal"/"float"/"double"/"duration"/"dateTime"/"time"/"date"/"gYearMonth"/"gYear"/"gMonthDay"/"gDay"/"gMonth"/"hexBinary"/"base64Binary"/"anyURI"/"QName"/"NOTATION"
elem_derived_types = "normalizedString"/"token"/"language"/"NMTOKEN"/"NMTOKENS"/"Name"/"NCName"/"ID"/"IDREF"/"IDREFS"/"ENTITY"/"ENTITIES"/"integer"/"nonPositiveInteger"/"negativeInteger"/"long"/"int"/"short"/"byte"/"nonNegativeInteger"/"unsignedLong"/"unsignedInt"/"unsignedShort"/"unsignedByte"/"positiveInteger"

list_types = fst:type_value? others:(ws2 n:type_value {return n})* ws {if (fst !== null) others.unshift(fst); return others}