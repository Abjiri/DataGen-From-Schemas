// Gramática para "DataGen from Schemas" -----

{
  // Variáveis gerais ------------------------------

  // queue para invocações de funções de validação de referências na schema (refs e types) - para os elementos referenciados não terem de aparecer antes das referências
  let queue = []
  // prefixo definido na declaração da schema
  let default_prefix = null
  // prefixos de namespaces declarados na schema
	let prefixes = []
  // número de elementos aninhados dentro do <schema> correntemente
  let schema_depth = 0
  // nomes (únicos) dos elementos globais com esse atributo
  let names = {attribute: [], attributeGroup: [], element: [], elem_constraint: [], group: [], notation: []}
  // atributos "id" de elementos da schema - têm de ser únicos
  let ids = []
  // boleanos para saber se está a ser processado um <element> (para a função validationQueue.type), um <group> ou um <redefine>
  let curr = {element: false, group: false, redefine: false}
  
  
  // Variáveis relacionadas com tipos ------------------------------

  // verificar se o resultado de uma função invocada de uma API vem com erro ou não 
  const checkError = obj => ("error" in obj) ? error(obj.error) : obj.data

  // array dos tipos embutidos da XML Schema em formato da DSL ({element, attrs, content})
  let simpleTypes = restrictionsAPI.create_simpleTypes(default_prefix)
  // número de simple/complexTypes aninhados correntemente
  let type_depth = 0
  // nome do simple/complexType a ser processado neste momento
  let current_type = null
  // nomes dos novos tipos definidos na schema - têm de ser únicos
  let local_types = {simpleType: [], complexType: [], simpleContent: []}
  // boleano para indicar se um tipo referenciado tem de corresponder a um tipo built-in ou simpleType apenas (false), ou pode ser um complexType também (true) 
  let any_type = "BSC"

  
  // Funções auxiliares gerais ------------------------------

  // verificar se o elemento pai é o <schema>
  const atRoot = () => !schema_depth
  // verificar se não foi definido um prefixo para a schema
  const noSchemaPrefix = () => default_prefix === null
  // verificar se o prefixo usado foi declarado na definição da schema
  const existsPrefix = p => prefixes.includes(p) ? true : error("Este prefixo não foi declarado no início da schema!")
  // verificar se as aspas/apóstrofes são fechados consistentemente - se sim, retorna o objeto {attr,val} em que foram usadas (ou apenas true, para as invocações da declaração XML)
  const checkQM = (q1,q2,attr,val) => q1 === q2 ? (attr===null ? true : {attr,val}) : error("Deve encapsular o valor em aspas ou em apóstrofes. Não pode usar um de cada!")
  // executar todas as invocações guardadas na queue para ver se são válidas
  const checkQueue = () => queue.reduce((accum, curr) => accum && queueFuncs[curr.attr](...curr.args), true)
  // se for null, converte para array vazio; senão, remove os nulls do array
  const cleanContent = content => content === null ? [] : content.filter(e => e !== null)

  // funções invocadas pela queue
  const queueFuncs = {
    // validar se o atributo "ref" está a referenciar um <element/attribute> global válido da schema ou de uma schema importada (só se valida o prefixo, neste caso)
    ref: (ref, el_name) => (ref.includes(":") || names[el_name].includes(ref)) ? true : error(`Está a tentar referenciar um elemento <${el_name}> inexistente! Só é possível referenciar elementos globais.`),
    // verificar que o tipo local que está a ser referenciado existe
    type: (type, prefix, curr_any_type, curr_type, curr_el) => {
      let error_msg = {
        BSC: "tipo embutido, simpleType ou complexType",
        BS: "tipo embutido ou simpleType",
        C: "complexType"
      }
        
      if (curr_any_type != "C" && restrictionsAPI.built_in_types(simpleTypes).includes(type)) {
        return prefix === default_prefix ? true : error(`Para especificar um dos tipos embutidos de schemas XML, tem de o prefixar com o prefixo do namespace desta schema.
                                                        ${(noSchemaPrefix() && prefix !== null) ? " Neste caso, como não declarou um prefixo para o namespace da schema, não deve prefixar o tipo também." : ""}`)
      }
      if (prefix == null || prefix == default_prefix) {
        if (!existsLocalType(type)) return error(`Tem de referenciar um ${error_msg[curr_any_type]} válido!`)
        if (!curr_el && type === curr_type) return error(`Definições circulares detetadas para o tipo '${type}'! Isto significa que o '${type}' está contido na sua própria hierarquia, o que é um erro.`)
      }
      return true
    }
  }
  
  // copiar os atributos de um elemento referenciado para o elemento que o referencia
  function complete_refs(content, global_elems) {
    for (let i = 0; i < content.length; i++) {
      // verificar se é um <element> com "ref"
      if ("ref" in content[i].attrs) {
        // identificar o elemento global que referenceia
        let elem = global_elems.filter(x => x.attrs.name == content[i].attrs.ref)[0]
        // copiar os seus atributos e o conteúdo
        content[i].attrs = {...elem.attrs, ...content[i].attrs}
        content[i].content = elem.content
        // apagar o atributo "ref", que já não é relevante
        delete content[i].attrs.ref
      }
      // se for um elemento básico (sem "ref" nem filhos) e não tiver "type", assume-se que é string
      else if (content[i].element == "element" && !("type" in content[i].attrs) && !content[i].content.length) content[i].attrs.type = default_prefix + ":string"

      // repetir recursivamente para os elementos filho
      if (Array.isArray(content[i].content)) content[i].content = complete_refs(content[i].content, global_elems)
    }
    
    return content
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

  // verificar que um elemento não tem <element/attribute> locais com o mesmo nome
  function check_repeatedNames(parent, el_name, content) {
    // filtrar apenas os elementos <element/attribute> do conteúdo e ir buscar os respetivos atributos "name" (remover os atributos que não têm nome, mas sim ref)
    let names = content.filter(x => x.element == el_name).map(x => x.attrs.name).filter(x => x != undefined)

    // verificar se há nomes repetidos no array
    let duplicates = names.filter((item, index) => names.indexOf(item) !== index)
    if (duplicates.length > 0) return error(`Os elementos <${el_name}> locais de um elemento devem ter todos nomes distintos entre si! Neste caso, o elemento <${parent}> tem mais do que um <${el_name}> com o nome '${duplicates[0]}'.`)
    return true
  }

  // verificar que o filho de um <group> não tem os atributos 'max/minOccurs'
  function check_groupContent(content) {
    if (!atRoot() && content.length > 0) return error("Os elementos <group> devem ser definidos globalmente e referenciados dentro de outros elementos!")

    if (content.some(x => "maxOccurs" in x.attrs || "minOccurs" in x.attrs))
      return error(`O elemento filho de um <group> não podem possuir os atributos 'maxOccurs' ou 'minOccurs'! Só o elemento <group> em si.`)
      
    if (content.length > 0) {
      content[0].attrs.maxOccurs = 1
      content[0].attrs.minOccurs = 1
    }

    return content
  }


  // Funções auxiliares relacionadas com atributos ------------------------------

  // juntar todos os atributos do elemento num só objeto
  const getAttrs = objArr => objArr === null ? {} : cleanContent(objArr).reduce(((r,c) => { r[c.attr] = c.val; return r }), {})
  // verificar se o array de atributos tem algum atributo repetido
  const check_repeatedAttrs = (arr, attrs, el_name) => (Object.keys(attrs).length == arr.length) ? attrs : error(`O elemento <${el_name}> não pode possuir atributos repetidos!`)
  // validar os atributos de um elemento <any/all/choice/sequence>
  const check_occursAttrs = (arr, el_name) => attrsAPI.defaultOccurs(check_repeatedAttrs(arr, getAttrs(arr), el_name), curr)
  // verificar se o atributo em questão está presente
  const check_requiredAttr = (attrs, el_name, attr_name) => attr_name in attrs ? attrs : error(`Um elemento <${el_name}> requer o atributo '${attr_name}'!`)
  // validar um elemento <element/attribute> básico - verificar que tem os atributos essenciais
  const validateLocalEl = attrs => "ref" in attrs || "name" in attrs
  // verificar se o novo id é único na schema
  const validateID = id => !ids.includes(id) ? true : error(`O valor do atributo 'id' deve ser único na schema! Existe mais do que um elemento na schema com o id '${id}'!`)

  // validar o nome de um <element/attribute/notation> - deve ser único
  function validateName(name, el_name) {
    // verificar que são elementos globais
    if (atRoot()) {
      if (!names[el_name].includes(name)) {names[el_name].push(name); return true}
      return error(`Todos os elementos <${el_name}> ${el_name != "notation" ? "definidos globalmente " : ""}devem ter nomes únicos!`)
    }
    if (["key","keyref","unique"].includes(el_name)) {
      if (!names.elem_constraint.includes(name)) {names.elem_constraint.push(name); return true}
      return error(`Todos os elementos <key>, <keyref> e <unique> devem ter nomes únicos!`)
    }
    return true
  }

  // validar o valor de atributos que sejam listas
  function validate_listOfValues(l, error_msg) {
    let arr = l.split(/[ \t\n\r]+/)
    return (new Set(arr)).size === arr.length ? true : error(error_msg)
  }

  // validar o valor do atributo "namespace" de um elemento <any/anyAttribute>, se não for ##any nem ##other
  function check_namespace(l) {
    let arr = l.split(/[ \t\n\r]+/)
    let error_msg = "O valor do atributo 'namespace' deve corresponder a ((##any | ##other) | Lista de (referência_URI | (##targetNamespace | ##local)))!"

    // verificar que não tem mais do que 1 URI
    if (arr.filter(x => x != "##local" && x != "##targetNamespace").length > 1) return error(error_msg)
    // verificar que não tem nenhum valor repetido
    return (new Set(arr)).size === arr.length ? true : error(error_msg)
  }

  // validar as tags e verificar se o atributo "base" está presente
  function check_requiredBase(el_name, parent_el, prefix, attrs, close) {
    if (!("base" in attrs)) return error(`O atributo 'base' é requirido num elemento <${el_name}> (${parent_el})!`)
    return check_elTags(el_name, prefix, close) && check_repeatedNames(el_name, "attribute", close.content)
  }
  
  // verificar que um elemento <element> não tem o atributo "ref" e um dos elementos filhos mutualmente exclusivos com esse
  function check_elemMutex(attrs, content) {
    if ("ref" in attrs && content.some(x => ["simpleType","complexType","key","keyref","unique"].includes(x.element)))
      return error(`Se o atributo 'ref' está presente num elemento <element>, o seu conteúdo não pode conter nenhum elemento <simpleType>, <complexType>, <key>, <keyref> ou <unique>!`)
    return true
  }

  // verificar que um elemento <attribute> não tem um elemento filho <simpleType> e um dos atributos mutualmente exclusivos com esse
  function check_attrMutex(attrs, content) {
    let error_msg = attr => `O atributo '${attr}' só pode estar presente no elemento <attribute> quando o seu conteúdo não contém um elemento <simpleType>!`

    if (content.some(x => x.element === "simpleType")) {
      if ("type" in attrs) return error(error_msg("type"))
      if ("ref" in attrs) return error(error_msg("ref"))
    }

    return true
  }

  // verificar que um elemento <attributeGroup> não tem conteúdo se tiver o atributo "ref"
  function check_attrGroupMutex(attrs, content) {
    if (!atRoot() && content.length > 0) return error("Os elementos <attributeGroup> devem ser definidos globalmente e referenciados dentro de outros elementos!")

    if ("ref" in attrs && content.some(x => x.element != "annotation"))
      return error("Se um elemento <attributeGroup> tiver o atributo 'ref' especificado, o seu conteúdo só pode ser, no máximo, um elemento <annotation>!")
    return true
  }

  // verificar que um elemento <complexType> não tem o atributo "mixed" e um elemento filho simpleContent
  function check_complexTypeMutex(attrs, content) {
    if (attrs.mixed && content.some(x => x.element == "simpleContent"))
      return error("Se um elemento <complexType> tiver um elemento filho <simpleContent>, não é permitido o atributo 'mixed'!")

    if (content.filter(x => ["simpleContent","complexContent","group","sequence","choice","all"].includes(x.element)).length > 1)
      return error('Um elemento <complexType> só pode conter apenas um dos seguintes elementos: <simpleContent>, <complexContent>, <group>, <sequence>, <choice> ou <all>!')
    
    if ("name" in attrs && content.some(x => x.element == "simpleContent")) local_types.simpleContent.push(attrs.name)
    return true
  }


  // Funções auxiliares relacionadas com tipos ------------------------------
  
  // verificar se já existe algum tipo local com este nome
  const existsLocalType = type => (any_type == "BSC" && Object.values(local_types).flat().includes(type)) || 
                                  (any_type == "BS" && local_types.simpleType.includes(type)) || 
                                  (any_type == "C" && local_types.complexType.includes(type))
  // validar um elemento <union> - verificar que referencia algum tipo
  const validateUnion = (attrs,content) => ("memberTypes" in attrs ? attrs.memberTypes.length : 0) + content.filter(e => e.element === "simpleType").length > 0 ? true : 
                                           error(`Um elemento <union> deve ter o atributo 'memberTypes' não vazio e/ou pelo menos um elemento filho <simpleType>!`)
  // validar o atributo base de um elemento <restriction> (simpleContent)
  const validateBaseSC = base => (!local_types.complexType.includes(base) || local_types.simpleContent.includes(base)) ? true :
                                  error("Num elemento <restriction> (simpleContent), para o atributo 'base' poder referenciar um <complexType>, o tipo desse elemento deve ser um tipo embutido, <simpleType> ou <simpleContent>!")

  // verificar se o nome do novo tipo já existe e adicioná-lo à lista de nomes respetiva caso seja único
  function newLocalType(name, kind) {
    if (Object.values(local_types).flat().includes(name)) return error("Já existe um simpleType/complexType com este nome nesta schema!")
    local_types[kind].push(name)
    current_type = name
    return true
  }

  // validar o tipo de um elemento de derivação - tem de ter ou o atributo de referência ou um elemento filho <simpleType>
  function check_derivingType(elem, attr, attrs, content) {
    if (attr in attrs && content.some(x => x.element === "simpleType"))
      return error(`A utilização do elemento filho <simpleType> e do atributo '${attr}' é mutualmente exclusiva no elemento <${elem}>!`)
    if (!(attr in attrs) && !content.filter(x => x.element == "simpleType").length)
      return error(`Um elemento <${elem}> deve ter o atributo '${attr}' ou um elemento filho <simpleType> para indicar o tipo a derivar!`)
    return true
  }
}

DSL_text = ws comment? XML_declaration ws comment? xsd:schema { return {xsd, simpleTypes} }

ws "whitespace" = [ \t\n\r]*
ws2 = [ \t\n\r]+


// ----- Declaração XML -----

XML_declaration = "<?xml" XML_version XML_encoding? XML_standalone? ws '?>'

XML_version = ws2 "version" ws "=" ws q1:QM "1.0" q2:QM &{return checkQM(q1,q2,null,null)}

XML_encoding = ws2 "encoding" ws "=" ws q1:QM XML_encoding_value q2:QM &{return checkQM(q1,q2,null,null)}
XML_encoding_value = "UTF-"("8"/"16") / "ISO-10646-UCS-"("2"/"4") / "ISO-8859-"[1-9] / "ISO-2022-JP" / "Shift_JIS" / "EUC-JP"

XML_standalone = ws2 "standalone" ws "=" ws q1:QM XML_standalone_value q2:QM &{return checkQM(q1,q2,null,null)}
XML_standalone_value = "yes" / "no"

// ----- <schema> -----

schema = (p:open_XSD_el {default_prefix = p}) el_name:"schema" attrs:schema_attrs ws ">" ws content:schema_content close_schema
         &{return checkQueue()} {
  content = complete_refs(content, content)
  return {element: el_name, prefix: default_prefix, attrs, content: content.filter(x => x.element == "element")}
}

close_schema = prefix:close_XSD_prefix "schema" ws ">" ws &{
  if (!noSchemaPrefix() && prefix === null) return error("Precisa de prefixar o elemento de fecho da schema!")
  if (noSchemaPrefix() && prefix !== null) return error("Não pode usar um prefixo aqui porque não predefiniu um prefixo para o namespace da schema!")
  if (prefix !== default_prefix) return error ("Precisa de prefixar o elemento de fecho da schema com o prefixo predefinido do seu namespace!")
  return true
}

schema_attrs = attrs:(formDefault / blockDefault / finalDefault / xmlns / elem_id / elem_lang / schema_version / targetNamespace)+
              &{return checkError(attrsAPI.check_schemaAttrs(attrs, default_prefix))} {return attrs}

formDefault = ws2 attr:$(("attribute"/"element")"FormDefault") ws "=" q1:QMo val:form_values q2:QMc {return checkQM(q1,q2,attr,val)}
blockDefault = ws2 attr:"blockDefault" ws "=" q1:QMo val:block_values q2:QMc                        {return checkQM(q1,q2,attr,val)}
finalDefault = ws2 attr:"finalDefault" ws "=" q1:QMo val:finalDefault_values q2:QMc                 {return checkQM(q1,q2,attr,val)}
xmlns = ws2 "xmlns" prefix:(":" p:NCName {return p})? ws "=" ws val:string                          {prefixes.push(prefix); return {attr: "namespace", prefix, val}}
schema_version = ws2 attr:"version" ws "=" ws val:string                                            {return {attr, val: val.trim().replace(/[\t\n\r]/g," ").replace(/ +/g," ")}} // o valor da versão é um xs:token, que remove todos os \t\n\r da string, colapsa os espaços e dá trim à string
targetNamespace = ws2 attr:"targetNamespace" ws "=" ws val:string                                   {return {attr, val}}

schema_content = comment? el:((redefine / include / import / annotation)* (((simpleType / complexType / group / attributeGroup) / element / attribute / notation) annotation*)*) {return cleanContent(el.flat(3))}


// ----- <include> -----

include = prefix:open_XSD_el el_name:"include" attrs:schemaLocID_attrs ws close:(merged_close / ann_content)
          &{return check_elTags(el_name, prefix, close)}
          {return {element: el_name, attrs, content: close.content}}

schemaLocID_attrs = el:(schemaLocation elem_id? / elem_id schemaLocation?)? {return check_requiredAttr(getAttrs(el), "include", "schemaLocation")}

schemaLocation = ws2 attr:"schemaLocation" ws "=" ws val:string {return {attr, val}}


// ----- <import> -----

import = prefix:open_XSD_el el_name:"import" attrs:import_attrs ws close:(merged_close / ann_content)
         &{return check_elTags(el_name, prefix, close)}
         {return {element: el_name, attrs, content: close.content}}

import_attrs = el:(import_namespace / elem_id / schemaLocation)* {return check_repeatedAttrs(el, getAttrs(el), "import")}

import_namespace = ws2 attr:"namespace" ws "=" ws val:string {return {attr, val}}


// ----- <redefine> -----

redefine = prefix:open_XSD_el el_name:$("redefine" {curr.redefine = true}) attrs:schemaLocID_attrs ws 
           close:(merged_close / openEl content:redefine_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
           &{return check_elTags(el_name, prefix, close)}
           {curr.redefine = false; return {element: el_name, attrs, content: close.content}}

redefine_content = c:(annotation / (simpleType / complexType / group / attributeGroup))* {return cleanContent(c)}


// ----- <element> -----

element = prefix:open_XSD_el el_name:$("element" {any_type = "BSC"; curr.element = true}) attrs:element_attrs ws
          close:(merged_close / openEl content:element_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) &{
  if ((close.merged || !close.content.length) && !validateLocalEl(attrs)) return error("Um elemento local deve ter, pelo menos, o atributo 'name' ou 'ref'!")
  return check_elTags(el_name, prefix, close) && check_elemMutex(attrs, close.content)
} {return {element: el_name, attrs, content: close.content}}

element_attrs = el:(elem_abstract / elem_block / elem_default / elem_substitutionGroup /
                elem_final / elem_fixed / elem_form / elem_id / elem_minOccurs /
                elem_maxOccurs / elem_name / elem_nillable / elem_ref / elem_type)* {
  let attrs = checkError(attrsAPI.check_elemAttrs(el, schema_depth, curr))
  curr.element = false
  return attrs
}

elem_abstract = ws2 attr:"abstract" ws "=" q1:QMo val:boolean q2:QMc                                        {return checkQM(q1,q2,attr,val)}
elem_block = ws2 attr:"block" ws "=" q1:QMo val:block_values q2:QMc                                         {return checkQM(q1,q2,attr,val)}
elem_default = ws2 attr:"default" ws "=" ws val:string                                                      {return {attr,val}}
elem_final = ws2 attr:"final" ws "=" q1:QMo val:elem_final_values q2:QMc                                    {return checkQM(q1,q2,attr,val)}
elem_fixed = ws2 attr:"fixed" ws "=" ws val:string                                                          {return {attr,val}}
elem_form = ws2 attr:"form" ws "=" q1:QMo val:form_values q2:QMc                                            {return checkQM(q1,q2,attr,val)}
elem_id = ws2 attr:"id" ws "=" q1:QMo val:ID q2:QMc                                                         {return checkQM(q1,q2,attr,val)}
elem_maxOccurs = ws2 attr:"maxOccurs" ws "=" q1:QMo val:(int/"unbounded") q2:QMc                            {return checkQM(q1,q2,attr,val)}
elem_minOccurs = ws2 attr:"minOccurs" ws "=" q1:QMo val:int q2:QMc                                          {return checkQM(q1,q2,attr,val)}
elem_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc           &{return validateName(val,"element")} {return checkQM(q1,q2,attr,val)}
elem_nillable = ws2 attr:"nillable" ws "=" q1:QMo val:boolean q2:QMc                                        {return checkQM(q1,q2,attr,val)}
elem_lang = ws2 attr:"xml:lang" ws "=" q1:QMo val:language q2:QMc                                           {return checkQM(q1,q2,attr,val)}
elem_ref = ws2 attr:"ref" ws "=" q1:QMo val:QName q2:QMc {queue.push({attr: "ref", args: [val, "element"]}); return checkQM(q1,q2,attr,val)}
elem_source = ws2 attr:"source" ws "=" ws val:string                                                        {return {attr,val}}
elem_substitutionGroup = ws2 attr:"substitutionGroup" ws "=" q1:QMo val:QName q2:QMc                        {return checkQM(q1,q2,attr,val)}
elem_type = ws2 attr:"type" ws "=" q1:QMo val:type_value q2:QMc                                             {return checkQM(q1,q2,attr,val)}

element_content = c:(annotation? (simpleType / complexType)? (keyOrUnique / keyref)*) {return cleanContent(c.flat())}


// ----- <field> -----

field = prefix:open_XSD_el el_name:"field" attrs:field_attrs ws close:(merged_close / ann_content)
        &{return check_elTags(el_name, prefix, close)}
        {return {element: el_name, attrs, content: close.content}}

field_attrs = attrs:(field_xpath elem_id? / elem_id field_xpath?)? {return check_requiredAttr(getAttrs(attrs), "field", "xpath")}

field_xpath = ws2 attr:"xpath" ws "=" q1:QMo val:fieldXPath q2:QMc {return checkQM(q1,q2,attr,val)}


// ----- <selector> -----

selector = prefix:open_XSD_el el_name:"selector" attrs:selector_attrs ws close:(merged_close / ann_content)
           &{return check_elTags(el_name, prefix, close)}
           {return {element: el_name, attrs, content: close.content}}

selector_attrs = attrs:(selector_xpath elem_id? / elem_id selector_xpath?)? {return check_requiredAttr(getAttrs(attrs), "selector", "xpath")}

selector_xpath = ws2 attr:"xpath" ws "=" q1:QMo val:selectorXPath q2:QMc {return checkQM(q1,q2,attr,val)}


// ----- <key/unique> -----

keyOrUnique = prefix:open_XSD_el el_name:$("key"/"unique") 
              attrs:(a:keyOrUnique_attrs &{return check_requiredAttr(a, el_name, "name") && validateName(a.name, el_name)} {return a}) ws
              close:(merged_close / openEl content:xpath_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
              &{return check_elTags(el_name, prefix, close)}
              {return {element: el_name, attrs, content: close.content}}

keyOrUnique_attrs = attrs:(elem_constraint_name elem_id? / elem_id elem_constraint_name?)? {return getAttrs(attrs)}

elem_constraint_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc {return checkQM(q1,q2,attr,val)}

xpath_content = c:(annotation? (selector field+)) {return cleanContent(c.flat())}


// ----- <keyref> -----

keyref = prefix:open_XSD_el el_name:"keyref" attrs:(a:keyref_attrs &{return validateName(a.name, el_name)} {return a}) ws
         close:(merged_close / openEl content:xpath_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
         &{return check_elTags(el_name, prefix, close)}
         {return {element: el_name, attrs, content: close.content}}

keyref_attrs = attrs:(elem_id / elem_constraint_name / keyref_refer)* {return checkError(attrsAPI.check_keyrefAttrs(attrs))}

keyref_refer = ws2 attr:"refer" ws "=" q1:QMo val:QName q2:QMc {return checkQM(q1,q2,attr,val)}


// ----- <attribute> -----

attribute = prefix:open_XSD_el el_name:$("attribute" {any_type = "BS"}) attrs:attribute_attrs ws
            close:(merged_close / openEl content:attribute_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) &{
  if ((close.merged || !close.content.length) && !validateLocalEl(attrs)) return error("Um atributo local deve ter, pelo menos, o atributo 'name' ou 'ref'!")
  return check_elTags(el_name, prefix, close) && check_attrMutex(attrs, close.content)
} {return {element: el_name, attrs, content: close.content}}

attribute_attrs = el:(elem_default / elem_fixed / elem_form / elem_id / attr_name / attr_ref / elem_type / attr_use)*
                  {any_type = "BSC"; return checkError(attrsAPI.check_attributeElAttrs(el, "attribute", schema_depth))}

attr_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc                &{return validateName(val,"attribute")} {return checkQM(q1,q2,attr,val)}
attr_ref = ws2 attr:"ref" ws "=" q1:QMo val:QName q2:QMc      {queue.push({attr: "ref", args: [val, "attribute"]}); return checkQM(q1,q2,attr,val)}
attr_use = ws2 attr:"use" ws "=" q1:QMo val:use_values q2:QMc                                                      {return checkQM(q1,q2,attr,val)}

attribute_content = c:(annotation? simpleType?) {return cleanContent(c)}


// ----- <attributeGroup> -----

attributeGroup = prefix:open_XSD_el el_name:"attributeGroup" attrs:attributeGroup_attrs ws
                 close:(merged_close / openEl content:attributeGroup_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
                 &{return check_elTags(el_name, prefix, close) && check_attrGroupMutex(attrs, close.content) && check_repeatedNames(el_name, "attribute", close.content)} 
                 {return {element: el_name, attrs, content: close.content}}

attributeGroup_attrs = el:(elem_id / attrGroup_name / attrGroup_ref)* {return checkError(attrsAPI.check_attributeElAttrs(el, "attributeGroup", schema_depth))}

attrGroup_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc           &{return validateName(val,"attributeGroup")} {return checkQM(q1,q2,attr,val)}
attrGroup_ref = ws2 attr:"ref" ws "=" q1:QMo val:QName q2:QMc {queue.push({attr: "ref", args: [val, "attributeGroup"]}); return checkQM(q1,q2,attr,val)}

attributeGroup_content = c:(annotation? attributes) {return cleanContent(c.flat())}


// ----- <anyAttribute> -----

anyAttribute = prefix:open_XSD_el el_name:"anyAttribute" attrs:anyAttribute_attrs ws close:(merged_close / ann_content)
               &{return check_elTags(el_name, prefix, close)} 
               {return {element: el_name, attrs, content: close.content}}

anyAttribute_attrs = el:(elem_id / any_namespace / processContents)* {return check_repeatedAttrs(el, getAttrs(el), "anyAttribute")}

any_namespace = ws2 attr:"namespace" ws "=" ws val:namespace_values                          {return {attr, val}}
processContents = ws2 attr:"processContents" ws "=" q1:QMo val:processContents_values q2:QMc {return checkQM(q1,q2,attr,val)}


// ----- <any> -----

any = prefix:open_XSD_el el_name:"any" attrs:any_attrs ws close:(merged_close / ann_content)
      &{return check_elTags(el_name, prefix, close)} 
      {return {element: el_name, attrs, content: close.content}}

any_attrs = el:(elem_id / elem_maxOccurs / elem_minOccurs / any_namespace / processContents)* {return check_occursAttrs(el,"any")}


// ----- <simpleType> -----

simpleType = prefix:open_XSD_el el_name:$("simpleType" {any_type = "BS"}) attrs:simpleType_attrs ws (openEl {type_depth++}) ws content:simpleType_content close_el:close_XSD_el
             &{return check_elTags(el_name, prefix, {merged: false, ...close_el})} {
  if (!--type_depth) current_type = null

  let st = checkError(restrictionsAPI.restrict_simpleType(attrs.name, content, default_prefix, simpleTypes))
  if ("name" in attrs) simpleTypes[attrs.name] = JSON.parse(JSON.stringify(st))
  
  return {element: el_name, attrs, built_in_base: st.built_in_base, content: st.content}
}

simpleType_attrs = el:(simpleType_final / elem_id / simpleType_name)* {return checkError(attrsAPI.check_localTypeAttrs(el, "simpleType", schema_depth, curr))}

simpleType_final = ws2 attr:"final" ws "=" q1:QMo val:simpleType_final_values q2:QMc                       {return checkQM(q1,q2,attr,val)}
simpleType_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc &{return newLocalType(val,"simpleType")} {return checkQM(q1,q2,attr,val)}

simpleType_content = c:(annotation? (restrictionST / list / union)) {any_type = "BSC"; return cleanContent(c)}


// ----- <annotation> -----

annotation = prefix:open_XSD_el el_name:"annotation" attr:elem_id? ws
             close:(merged_close / openEl content:annotation_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
             &{return check_elTags(el_name, prefix, close)}
             {return null} //{return {element: el_name, attrs: getAttrs(attr), content: close.content}}

annotation_content = (appinfo / documentation)*


// ----- <appinfo> -----

appinfo = appinfo_simple / appinfo_prefix

appinfo_simple = "<" el_name:"appinfo" attr:elem_source? ws
                 close:("/>" ws {return ""} / openEl content:appinfo_content_simple? close_appinfo_simple {schema_depth--; return content===null ? "" : content})
                 {return {element: el_name, attrs: getAttrs(attr), content: close}}

appinfo_prefix = prefix:open_XSD_el el_name:"appinfo" attr:elem_source? ws
                 close:(merged_close / openEl content:appinfo_content_prefix? close_el:close_appinfo_prefix {schema_depth--; return {merged: false, ...close_el, content}})
                 &{return check_elTags(el_name, prefix, close)} 
                 {return {element: el_name, attrs: getAttrs(attr), content: (close.content === [] || close.content === null) ? "" : close.content}}

appinfo_content_simple = (!close_appinfo_simple). appinfo_content_simple* {return text().trim()}
appinfo_content_prefix = (!close_appinfo_prefix). appinfo_content_prefix* {return text().trim()}

close_appinfo_simple = "</appinfo" ws ">" ws
close_appinfo_prefix = prefix:close_XSD_prefix name:"appinfo" ws ">" ws {return {name, prefix}}


// ----- <documentation> -----

documentation = doc_simple / doc_prefix

documentation_attrs = attrs:(elem_source elem_lang? / elem_lang elem_source?)? {return getAttrs(attrs)}

doc_simple = "<" el_name:"documentation" attrs:documentation_attrs ws
             close:("/>" ws {return ""} / openEl content:doc_content_simple? close_doc_simple {schema_depth--; return content===null ? "" : content})
             {return {element: el_name, attrs, content: close}}

doc_prefix = prefix:open_XSD_el el_name:"documentation" attrs:documentation_attrs ws 
             close:(merged_close / openEl content:doc_content_prefix? close_el:close_doc_prefix {schema_depth--; return {merged: false, ...close_el, content}})
             &{return check_elTags(el_name, prefix, close)}
             {return {element: el_name, attrs, content: (close.content===[] || close.content===null) ? "" : close.content}}

doc_content_prefix = (!close_doc_prefix). doc_content_prefix* {return text().trim()}
doc_content_simple = (!close_doc_simple). doc_content_simple* {return text().trim()}

close_doc_simple = "</documentation" ws ">" ws
close_doc_prefix = prefix:close_XSD_prefix name:"documentation" ws ">" ws {return {name, prefix}}


// ----- <union> -----

union = prefix:open_XSD_el el_name:"union" attrs:union_attrs ws 
        close:(merged_close / openEl content:union_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
        &{return check_elTags(el_name, prefix, close) && validateUnion(attrs, close.content)}
        {return {element: el_name, attrs, content: close.content}}

union_attrs = attrs:(elem_id union_memberTypes? / union_memberTypes elem_id?)? {return getAttrs(attrs)}

union_memberTypes = ws2 attr:"memberTypes" ws "=" q1:QMo val:list_types q2:QMc {return checkQM(q1,q2,attr,val)}

union_content = c:(annotation? simpleType*) {return cleanContent(c.flat())}


// ----- <list> -----

list = prefix:open_XSD_el el_name:"list" attrs:list_attrs ws 
       close:(merged_close / openEl content:list_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
       &{return check_elTags(el_name, prefix, close) && check_derivingType(el_name, "itemType", attrs, close.content)} {
  let simpleType = "itemType" in attrs ? simpleTypes[attrs.itemType] : close.content[0]
  simpleType.element = el_name
  return simpleType
}

list_attrs = attrs:(elem_id list_itemType? / list_itemType elem_id?)? {return getAttrs(attrs)}

list_itemType = ws2 attr:"itemType" ws "=" q1:QMo val:type_value q2:QMc {return checkQM(q1,q2,attr,val)}

list_content = c:(annotation? simpleType?) {return cleanContent(c)}


// ----- <restriction> (simpleType) -----

restrictionST = prefix:open_XSD_el el_name:"restriction" attrs:base_attrs ws 
                close:(merged_close / openEl content:restrictionST_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
                &{return check_elTags(el_name, prefix, close) && check_derivingType(el_name, "base", attrs, close.content)} {
  let base = "base" in attrs ? attrs.base : close.content[0].built_in_base
  return {element: el_name, attrs, content: checkError(restrictionsAPI.check_restrictionST_facets(el_name, base, close.content, default_prefix, simpleTypes))}
}

base_attrs = attrs:(base elem_id? / elem_id base?)? {return getAttrs(attrs)}

base = ws2 attr:"base" ws "=" q1:QMo val:type_value q2:QMc {return checkQM(q1,q2,attr,val)}
                     
restrictionST_content = h1:annotation? h2:simpleType? t:constrFacet* {return cleanContent([h1, h2, ...t])}


// ----- <restriction> (simpleContent) -----

restrictionSC = prefix:open_XSD_el el_name:"restriction" attrs:base_attrs ws 
                close:(merged_close / openEl content:restrictionSC_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
                &{return check_requiredBase(el_name, "simpleContent", prefix, attrs, close)}
                {return {element: el_name, attrs, content: close.content}}
                     
restrictionSC_content = c:(restrictionST_content attributes) {return cleanContent(c.flat())}


// ----- <restriction> (complexContent) -----

restrictionCC = prefix:open_XSD_el el_name:"restriction" attrs:base_attrs ws 
                close:(merged_close / openEl content:CC_son_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
                &{return check_requiredBase(el_name, "complexContent", prefix, attrs, close)}
                {return {element: el_name, attrs, content: close.content}}
                     
CC_son_content = c:(annotation? (all / choiceOrSequence / group)? attributes) {return cleanContent(c.flat())}


// ----- <extension> (simpleContent) -----

extensionSC = prefix:open_XSD_el el_name:"extension" attrs:base_attrs ws 
              close:(merged_close / openEl content:extensionSC_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
              &{return check_requiredBase(el_name, "simpleContent", prefix, attrs, close)}
              {return {element: el_name, attrs, content: close.content}}
                     
extensionSC_content = c:(annotation? attributes) {return cleanContent(c.flat())}


// ----- <extension> (complexContent) -----

extensionCC = prefix:open_XSD_el el_name:"extension" attrs:base_attrs ws 
              close:(merged_close / openEl content:CC_son_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
              &{return check_requiredBase(el_name, "complexContent", prefix, attrs, close)}
              {return {element: el_name, attrs, content: close.content}}


// ----- <minExclusive> <minInclusive> <maxExclusive> <maxInclusive> <totalDigits <fractionDigits> <length> <minLength> <maxLength> <enumeration> <whiteSpace> <pattern> -----

constrFacet = prefix:open_XSD_el el_name:constrFacet_values 
              attrs:(a:constrFacet_attrs ws {return checkError(attrsAPI.check_constrFacetAttrs(el_name, a))})
              close:(merged_close / ann_content)
              &{return check_elTags(el_name, prefix, close)}
              {return {element: el_name, attrs, content: close.content}}

constrFacet_attrs = el:(elem_id / constrFacet_fixed / constrFacet_value)* {return el}

constrFacet_fixed = ws2 attr:"fixed" ws "=" q1:QMo val:boolean q2:QMc {return checkQM(q1,q2,attr,val)}
constrFacet_value = ws2 attr:"value" ws "=" ws val:string             {return {attr, val}}


// ----- <complexType> -----

complexType = prefix:open_XSD_el el_name:"complexType" attrs:complexType_attrs ws 
              close:(merged_close / (openEl {type_depth++}) content:complexType_content close_el:close_XSD_el {return {merged: false, ...close_el, content}})
              &{return check_elTags(el_name, prefix, close) && check_complexTypeMutex(attrs, close.content) && check_repeatedNames(el_name, "attribute", close.content)}
              {if (!--type_depth) current_type = null; return {element: el_name, attrs, content: close.content}}

complexType_attrs = el:(elem_abstract / complexType_block / elem_final / elem_id / complex_mixed / complexType_name)* 
                    {return attrsAPI.check_localTypeAttrs(el, "complexType", schema_depth, curr)}

complexType_block = ws2 attr:"block" ws "=" q1:QMo val:elem_final_values q2:QMc                              {return checkQM(q1,q2,attr,val)}
complex_mixed = ws2 attr:"mixed" ws "=" q1:QMo val:boolean q2:QMc                                            {return checkQM(q1,q2,attr,val)}
complexType_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc &{return newLocalType(val,"complexType")} {return checkQM(q1,q2,attr,val)}

complexType_content = c:(annotation? (simpleContent / complexContent / (all / choiceOrSequence / group)? attributes)) {return cleanContent(c.flat(2))}


// ----- <simpleContent> -----

simpleContent = prefix:open_XSD_el el_name:"simpleContent" attr:elem_id? ws openEl content:simpleContent_content close_el:close_XSD_el
                &{return check_elTags(el_name, prefix, {merged: false, ...close_el})}
                {return {element: el_name, attrs: getAttrs(attr), content}}

simpleContent_content = c:(annotation? (restrictionSC / extensionSC)) {return cleanContent(c)}


// ----- <complexContent> -----

complexContent = prefix:open_XSD_el el_name:$("complexContent" {any_type = "C"}) attrs:complexContent_attrs ws openEl content:complexContent_content close_el:close_XSD_el
                 &{return check_elTags(el_name, prefix, {merged: false, ...close_el})}
                 {return {element: el_name, attrs, content}}

complexContent_attrs = attrs:(complex_mixed elem_id? / elem_id complex_mixed?)? {return getAttrs(attrs)}

complexContent_content = c:(annotation? (restrictionCC / extensionCC)) {any_type = "BSC"; return cleanContent(c)}


// ----- <all> -----

all = prefix:open_XSD_el el_name:"all" attrs:all_attrs ws 
      close:(merged_close / openEl content:all_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
      &{return check_elTags(el_name, prefix, close) && check_repeatedNames(el_name, "element", close.content)}
      {return {element: el_name, attrs, content: close.content}}

all_attrs = el:(elem_id / all_maxOccurs / all_minOccurs)* {return check_occursAttrs(el,"all")}

all_maxOccurs = ws2 attr:"maxOccurs" ws "=" q1:QMo val:"1"  q2:QMc {return checkQM(q1,q2,attr,parseInt(val))}
all_minOccurs = ws2 attr:"minOccurs" ws "=" q1:QMo val:[01] q2:QMc {return checkQM(q1,q2,attr,parseInt(val))}

all_content = c:(annotation? element*) {return cleanContent(c.flat())}


// ----- <choice/sequence> -----

choiceOrSequence = prefix:open_XSD_el el_name:$("choice"/"sequence") attrs:(a:choiceOrSeq_attrs {return check_occursAttrs(a, el_name)}) ws 
                   close:(merged_close / openEl content:choiceOrSeq_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
                   &{return check_elTags(el_name, prefix, close) && check_repeatedNames(el_name, "element", close.content)}
                   {return {element: el_name, attrs, content: close.content}}

choiceOrSeq_attrs = el:(elem_id / elem_maxOccurs / elem_minOccurs)* {return el}

choiceOrSeq_content = c:(annotation? (element / choiceOrSequence / group / any)*) {return cleanContent(c.flat())}


// ----- <group> -----

group = prefix:open_XSD_el el_name:"group" attrs:group_attrs ws 
        close:(merged_close / openEl content:group_content close_el:close_XSD_el {return {merged: false, ...close_el, content}}) 
        &{return check_elTags(el_name, prefix, close)}
        {curr.group = false; return {element: el_name, attrs, content: check_groupContent(close.content)}}

group_attrs = el:(group_name / elem_id / elem_maxOccurs / elem_minOccurs / group_ref)*
              {let attrs = checkError(attrsAPI.check_groupAttrs(el, schema_depth, curr)); curr.group = true; return attrs}

group_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc           &{return validateName(val,"group")} {return checkQM(q1,q2,attr,val)}
group_ref = ws2 attr:"ref" ws "=" q1:QMo val:QName q2:QMc {queue.push({attr: "ref", args: [val, "group"]}); return checkQM(q1,q2,attr,val)}

group_content = c:(annotation? (all / choiceOrSequence)) {return cleanContent(c)}


// ----- <notation> -----

notation = prefix:open_XSD_el el_name:"notation" attrs:notation_attrs ws close:(merged_close / ann_content)
          &{return check_elTags(el_name, prefix, close)}
          {return {element: el_name, attrs, content: close.content}}

notation_attrs = el:(elem_id / notation_name / notation_URI_attrs)* {return checkError(attrsAPI.check_notationAttrs(el))}

notation_name = ws2 attr:"name" ws "=" q1:QMo val:NCName q2:QMc &{return validateName(val,"notation")} {return checkQM(q1,q2,attr,val)}
notation_URI_attrs = ws2 attr:("public" / "system") ws "=" ws val:string {return {attr, val}}


// ----- Comentário -----

comment = "<!--" comment_content close_comment ws
comment_content = (!close_comment). comment_content*
close_comment = "-->"


// ----- Regex recorrentes -----

openEl  = ">" ws {schema_depth++}
closeEl = ">" ws {schema_depth--}

open_XSD_el      = "<"  prefix:(p:NCName ":" {return p})? {return prefix}
close_XSD_prefix = "</" prefix:(p:NCName ":" {return p})? {return prefix}

merged_close = "/>" ws {return {merged: true, content: []}}

close_XSD_el = prefix:close_XSD_prefix name:XSD_el_name ws closeEl {return {name, prefix}}
ann_content = openEl content:annotation? close_el:close_XSD_el {return {merged: false, ...close_el, content: cleanContent(content)}}

attributes = c:((attribute / attributeGroup)* anyAttribute?) {return c.flat()}


// ----- Valores -----

QM = '"' / "'" // quotation mark sem whitespaces
QMo = ws qm:('"' / "'") ws {return qm} // quotation mark open
QMc = ws qm:('"' / "'") {return qm} // quotation mark close

boolean = true / false
false = "false" { return false }
true  = "true"  { return true }
null  = "null"  { return null }

int = integer:(("0"* i:([1-9] [0-9]*) {return i}) / (i:"0" "0"* {return i})) {return parseInt(Array.isArray(integer) ? integer.flat().join("") : integer)}

letter = [a-zA-Z]
letter1_8 = $(letter letter? letter? letter? letter? letter? letter? letter?)
string = ('"'[^"]*'"' / "'"[^']*"'") {return text().slice(1,-1)}

NCName = $(([a-zA-Z_]/[^\x00-\x7F])([a-zA-Z0-9.\-_]/[^\x00-\x7F])*)
QName = $((p:NCName ":" &{return existsPrefix(p)})? NCName)
ID = id:NCName &{return validateID(id)} {ids.push(id); return id}
language = $((letter letter / [iI]"-"letter+ / [xX]"-"letter1_8)("-"letter1_8)?)

XSD_el_name = "include" / "import" / "redefine" / "notation" / "annotation" / "appinfo" / "documentation" / 
              "element" / "field" / "selector" / "key" / "keyref" / "unique" / 
              "attributeGroup" / "attribute" / "anyAttribute" / 
              "simpleType" / "union" / "list" / "restriction" / "extension" / constrFacet_values /
              "complexType" / "simpleContent" / "complexContent" / "all" / "choice" / "group" / "sequence" / "any"


// ----- Valores simples de atributos -----

form_values = $("un"?"qualified")
use_values = "optional" / "prohibited" / "required"
processContents_values = "lax" / "skip" / "strict"
constrFacet_values = $("length" / ("max"/"min")"Length" / ("max"/"min")("Ex"/"In")"clusive" / ("total"/"fraction")"Digits" / "whiteSpace" / "pattern" / "enumeration")

// um tipo válido tem de ser um dos seguintes: tipo built-in (com ou sem prefixo da schema); tipo de outra schema importada, com o prefixo respetivo; simple/complexType local
type_value = $(p:NCName ":" name:NCName &{return existsPrefix(p)} {queue.push({attr: "type", args: [name, p, any_type, current_type, Object.values(curr).some(x=>x)]})} // se for o prefixo desta schema, verifica-se que o tipo existe; se não for, assume-se que sim
             / name:NCName {queue.push({attr: "type", args: [name, null, any_type, current_type, Object.values(curr).some(x=>x)]})})


// ----- Listas de valores de atributos -----

finalDefault_values = "#all" / finalDefault_listOfValues
finalDefault_list_val = "extension" / "restriction" / "list" / "union"
finalDefault_listOfValues = l:$(finalDefault_list_val (ws2 finalDefault_list_val)*) &{return validate_listOfValues(l, 'O valor do atributo "finalDefault" deve corresponder a (#all | Lista de (extension | restriction | list | union))!')}

elem_final_values = "#all" / "extension" ws "restriction" / "restriction" ws "extension" / "extension" / "restriction"

list_types = ws fst:type_value? others:(ws2 n:type_value {return n})* ws {if (fst !== null) others.unshift(fst); return others}

block_values = "#all" / block_listOfValues
block_list_val = "extension" / "restriction" / "substitution"
block_listOfValues = l:$(block_list_val (ws2 block_list_val)*) &{return validate_listOfValues(l, 'O valor do atributo "block" deve corresponder a (#all | Lista de (extension | restriction | substitution))!')}

simpleType_final_values = "#all" / simpleType_final_listOfValues
simpleType_final_list_val = "list" / "union" / "restriction"
simpleType_final_listOfValues = l:$(simpleType_final_list_val (ws2 simpleType_final_list_val)*) &{return validate_listOfValues(l, 'O valor do atributo "final" do elemento <simpleType> deve corresponder a (#all | Lista de (list | union | restriction))!')}


namespace_values = (namespace_values_Q / namespace_values_A) {return text().slice(1,-1)}
namespace_values_Q = $('"' ws ("##any" / "##other" / l:namespace_listOfValues_Q &{return check_namespace(l)}) ws '"')
namespace_values_A = $("'" ws ("##any" / "##other" / l:namespace_listOfValues_A &{return check_namespace(l)}) ws "'")

namespace_list_val_Q = "##local" / "##targetNamespace" / $((!("##"/'"')). [^ "\t\n\r]+) // a string é um URI
namespace_list_val_A = "##local" / "##targetNamespace" / $((!("##"/"'")). [^ '\t\n\r]+) // a string é um URI

namespace_listOfValues_Q = $(namespace_list_val_Q (ws2 namespace_list_val_Q)*)
namespace_listOfValues_A = $(namespace_list_val_A (ws2 namespace_list_val_A)*)


// ----- XPath -----

selectorXPath = $(path ('|' path)*)
path = ('.//')? step ('/' step)*
fieldXPath = $(('.//')? (step '/')* (step / '@' nameTest))
step = '.' / nameTest  
nameTest = QName / '*' / NCName ':' '*'  