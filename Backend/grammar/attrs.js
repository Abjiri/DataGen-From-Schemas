// Funções auxiliares ----------

// retornar erro
const error = msg => {return {error: msg}}
// retorna dados encapsulados, se não houver nenhum erro
const data = x => {return {data: x}}
// se for null, converte para array vazio; senão, remove os nulls do array
const cleanContent = content => content === null ? [] : content.filter(e => e !== null)
// juntar todos os atributos do elemento num só objeto
const getAttrs = objArr => objArr === null ? {} : cleanContent(objArr).reduce(((r,c) => { r[c.attr] = c.val; return r }), {})
// verificar se o array de atributos tem algum atributo repetido
const check_repeatedAttrs = (arr, attrs, el_name) => (Object.keys(attrs).length == arr.length) ? attrs : error(`O elemento <${el_name}> não pode possuir atributos repetidos!`)

// adicionar os valores default dos atributos "max/minOccurs"
function defaultOccurs(attrs, curr) {
  // os filhos de um group (all/choice/sequence) não podem possuir estes atributos, logo não colocar por default
  // mas os <element> dentro dos filhos podem
  if (!curr.group || curr.element) {
    if (!("maxOccurs" in attrs)) attrs.maxOccurs = ("minOccurs" in attrs && attrs.minOccurs > 0) ? attrs.minOccurs : 1
    if (!("minOccurs" in attrs)) attrs.minOccurs = !attrs.maxOccurs ? 0 : 1
  }
  return attrs
}


// Funções de verificação de atributos ----------

// validar os atributos do elemento <schema>
function check_schemaAttrs(arr, default_prefix) {
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

    return data(attrs)
}

// validar os atributos de um elemento <element>
function check_elemAttrs(arr, schema_depth, curr) {
  let attrs = check_repeatedAttrs(arr, getAttrs(arr), "element")
  if ("error" in attrs) return attrs

  // restrições relativas à profundidade dos elementos
  if (!schema_depth) { // elementos da schema
    if ("ref" in attrs) return error("O atributo 'ref' é proibido num elemento <element> de schema!")
    if ("maxOccurs" in attrs) return error("O atributo 'maxOccurs' é proibido num elemento <element> de schema!")
    if ("minOccurs" in attrs) return error("O atributo 'minOccurs' é proibido num elemento <element> de schema!")
    if (!("name" in attrs)) return error("O atributo 'name' é requirido num elemento <element> de schema!")
  }
  // elementos aninhados
  else if ("final" in attrs) return error("O atributo 'final' é proibido num elemento <element> local!")

  // mensagem de erro de atributos mutuamente exclusivos
  let mutexc_error = (a1,a2) => error(`Em elementos <element>, os atributos '${a1}' e '${a2}' são mutuamente exclusivos!`)
  // atributos mutuamente exclusivos
  if ("default" in attrs && "fixed" in attrs) return mutexc_error("default","fixed")
  if ("ref" in attrs && "block" in attrs) return mutexc_error("ref","block")
  if ("ref" in attrs && "default" in attrs) return mutexc_error("ref","default")
  if ("ref" in attrs && "fixed" in attrs) return mutexc_error("ref","fixed")
  if ("ref" in attrs && "form" in attrs) return mutexc_error("ref","form")
  if ("ref" in attrs && "name" in attrs) return mutexc_error("ref","name")
  if ("ref" in attrs && "nillable" in attrs) return mutexc_error("ref","nillable")
  if ("ref" in attrs && "type" in attrs) return mutexc_error("ref","type")

  // maxOccurs não pode ser inferior a minOccurs
  if ("maxOccurs" in attrs && "minOccurs" in attrs && attrs.maxOccurs < attrs.minOccurs)
    return error("A propriedade 'maxOccurs' do elemento não pode ser inferior à 'minOccurs'!")

  // atributos com valores predefinidos
  if (schema_depth > 0) attrs = defaultOccurs(attrs, curr)
  if (!("abstract" in attrs)) attrs.abstract = false
  //if (!("form" in attrs)) attrs.form = //valor do atributo elementFormDefault do elemento da schema
  if (!("nillable" in attrs)) attrs.nillable = false

  return data(attrs)
}

// validar os atributos de um elemento <keyref>
function check_keyrefAttrs(arr) {
  let attrs = check_repeatedAttrs(arr, getAttrs(arr), "keyref")
  if ("error" in attrs) return attrs

  // atributos requiridos
  if (!("name" in attrs)) return error(`No elemento <keyref> é requirido o atributo 'name'!`)
  if (!("refer" in attrs) && !("system" in attrs)) return error(`No elemento <keyref> é requirido o atributo 'refer'!`)

  return data(attrs)
}

// validar os atributos de um elemento <attribute/attributeGroup>
function check_attributeElAttrs(arr, el_name, schema_depth) {
  let attrs = check_repeatedAttrs(arr, getAttrs(arr), el_name)
  if ("error" in attrs) return attrs

  // restrições relativas à profundidade dos elementos
  if (!schema_depth) { // elementos da schema
    if ("ref" in attrs) return error(`O atributo 'ref' é proibido num elemento <${el_name}> de schema!`)
    if (!("name" in attrs)) return error(`O atributo 'name' é requirido num elemento <${el_name}> de schema!`)
  }
  else {
    if (el_name == "attributeGroup") {
      if (!("ref" in attrs)) return error(`O atributo 'ref' é requirido num elemento <${el_name}> local!`)
      if ("name" in attrs) return error(`O atributo 'name' é proibido num elemento <${el_name}> local!`)
    }
  }

  // mensagem de erro de atributos mutuamente exclusivos
  let mutexc_error = (a1,a2) => error(`Em elementos <${el_name}>, os atributos '${a1}' e '${a2}' são mutuamente exclusivos!`)
  // atributos mutuamente exclusivos
  if ("name" in attrs && "ref" in attrs) return mutexc_error("name","ref")

  if (el_name == "attribute") {
    if ("default" in attrs && "fixed" in attrs) return mutexc_error("default","fixed")
    if ("ref" in attrs && "form" in attrs) return mutexc_error("ref","form")
    if ("ref" in attrs && "type" in attrs) return mutexc_error("ref","type")

    // atributos com valores predefinidos
    if (!("use" in attrs)) attrs.use = "optional"
  }

  return data(attrs)
}

// validar os atributos de um elemento <group>
function check_groupAttrs(arr, schema_depth, curr) {
  let attrs = check_repeatedAttrs(arr, getAttrs(arr), "group")
  if ("error" in attrs) return attrs

  // restrições relativas à profundidade dos elementos
  if (!schema_depth) { // elementos da schema
    if ("ref" in attrs) return error("O atributo 'ref' é proibido num elemento <group> de schema!")
    if (!("name" in attrs)) return error("O atributo 'name' é requirido num elemento <group> de schema!")
  }
  else {
    if (!("ref" in attrs)) return error("O atributo 'ref' é requirido num elemento <group> local!")
    if ("name" in attrs) return error("O atributo 'name' é proibido num elemento <group> local!")
  }

  // atributos com valores predefinidos
  return data(defaultOccurs(attrs, curr))
}

// validar os atributos de um elemento <notation>
function check_notationAttrs(arr) {
  let attrs = check_repeatedAttrs(arr, getAttrs(arr), "notation")
  if ("error" in attrs) return attrs

  // atributos requiridos
  if (!("name" in attrs)) return error(`No elemento <notation> é requirido o atributo 'name'!`)
  if (!("public" in attrs) && !("system" in attrs)) return error(`No elemento <notation> é requirido pelo menos um dos atributos 'public' e 'system'!`)

  return data(attrs)
}
  
// validar os atributos de um elemento <simpleType/complexType>
function check_localTypeAttrs(arr, el_name, schema_depth, curr) {
  let attrs = check_repeatedAttrs(arr, getAttrs(arr), el_name)
  if ("error" in attrs) return attrs
  
  // restrições relativas à profundidade dos elementos
  if (!schema_depth && !("name" in attrs)) return error(`O atributo 'name' é requirido se o pai do elemento <${el_name}> for o <schema>!`)
  if (schema_depth && !curr.redefine && "name" in attrs) return error(`O atributo 'name' é proibido se o pai do elemento <${el_name}> não for o <schema>!`)

  if (el_name == "complexType") {
    // atributos com valores predefinidos
    if (!("abstract" in attrs)) attrs.abstract = false
    if (!("mixed" in attrs)) attrs.mixed = false
  }

  return data(attrs)
}

// verificar que o nome do elemento de derivação, os atributos e o valor batem todos certo
// nesta função, só se verifica o espaço léxico do atributo "value" dos elementos <totalDigits>, <fractionDigits>, <length>, <minLength>, <maxLength>, <whiteSpace> e <pattern>
// para verificar os restantes elementos, é preciso o tipo base, faz-se mais à frente
function check_constrFacetAttrs(name, arr) {
    let attrs = check_repeatedAttrs(arr, getAttrs(arr), name)
    if ("error" in attrs) return attrs

    if ("value" in attrs) {
      if (name == "whiteSpace") {
        if (!["preserve","replace","collapse"].includes(attrs.value)) return error(`O valor da faceta <whiteSpace> deve ser um dos seguintes: {preserve, replace, collapse}!`)
      }
      else if (name == "totalDigits") {
        if (!/^\+?[1-9]\d*$/.test(attrs.value)) return error(`O valor da faceta 'totalDigits' deve ser um inteiro positivo!`)
        attrs.value = parseInt(attrs.value)
      } 
      else if (["fractionDigits","length","minLength","maxLength"].includes(name)) {
        if (!/^\+?\d+$/.test(attrs.value)) return error(`O valor da faceta <${name}> deve ser um inteiro não negativo!`)
        attrs.value = parseInt(attrs.value)
      }
    }

    // restrições relativas à existência dos atributos
    if (!("value" in attrs)) return error(`No elemento <${name}> é requirido o atributo 'value'!`)
    if (name == "pattern" || name == "enumeration") {
      if ("fixed" in attrs) return error(`O elemento <${name}> não aceita o atributo 'fixed'!`)
    }
    else if (!("fixed" in attrs)) attrs.fixed = false
    
    return data(attrs)
}

module.exports = {
  defaultOccurs,
  check_schemaAttrs,
  check_elemAttrs,
  check_keyrefAttrs,
  check_attributeElAttrs,
  check_groupAttrs,
  check_notationAttrs,
  check_localTypeAttrs,
  check_constrFacetAttrs
}