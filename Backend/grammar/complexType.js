const attrsAPI = require("./attrs")
const stAPI = require("./simpleType")

// Funções auxiliares ----------

// retornar erro
const error = msg => {return {error: msg}}
// retorna dados encapsulados, se não houver nenhum erro
const data = x => {return {data: x}}


// verificar se a base de um simpleContent é um tipo embutido, simpleType ou complexType com simpleContent
// só chegam extensions com base complexTypes à função 'extend'
function checkBaseSC(ct, base, complexTypes) {
    let name = "name" in ct.attrs ? `complexType '${ct.attrs.name}'` : "novo complexType"

    if (!(base in complexTypes && complexTypes[base].content[0].element == "simpleContent"))
        return error(`Na definição do ${name}, o tipo base '${base}' referenciado no elemento <simpleContent> é inválido! Deve ser um tipo embutido, simpleType ou complexType com simpleContent!`)
    return data(true)
}

// derivar um complexType por extensão de outro complexType
function extend(new_ct, complexTypes, attrGroups) {
    let new_child = new_ct.content[0]
    let base = new_child.content[0].attrs.base

    // feito à preguiçoso, só funciona para schema local!
    if (base.includes(":")) base = base.split(":")[1]
    
    // só chegam aqui extensions de simpleContent que tenham por base outros complexTypes
    if (new_ct.content[0].element == "simpleContent") {
        let check = checkBaseSC(new_ct, base, complexTypes)
        if ("error" in check) return check
    }
    
    // encontrar o complexType base referenciado na derivação do novo
    let base_ct = JSON.parse(JSON.stringify(complexTypes[base]))
    if (base_ct === undefined) return error(`O <complexType> '${base}' referenciado na base da derivação não existe!'`)
    
    if (new_child.element == "simpleContent") {
        let base_ext = base_ct.content[0].content[0]
        let name = "name" in new_ct.attrs ? `complexType '${new_ct.attrs.name}'` : "novo complexType"

        let getAttrsNames = (arr, el, prop) => arr.filter(x => x.element == el).map(x => x.attrs[prop])
        
        // verificar que não há atributos com o mesmo nome entre o tipo novo e o base
        let base_attrs = getAttrsNames(base_ext.content, "attribute", "name")
        let new_attrs = getAttrsNames(new_child.content[0].content, "attribute", "name")
        
        let repeated_attrs = base_attrs.filter(x => new_attrs.includes(x))
        if (repeated_attrs.length > 0) {
            let plural = repeated_attrs.length == 1 ? "o nome" : "os nomes"
            return error(`A definição do ${name} é inválida, porque possui mais do que um atributo com ${plural} '${repeated_attrs.join("', '")}'!`)
        }

        let base_attrGroups = getAttrsNames(base_ext.content, "attributeGroup", "ref")
        let new_attrGroups = getAttrsNames(new_child.content[0].content, "attributeGroup", "ref")
        
        let repeated_attrGroups = base_attrGroups.filter(x => new_attrGroups.includes(x))
        if (repeated_attrGroups.length > 0) {
            let plural = repeated_attrGroups.length == 1 ? "ao grupo" : "aos grupos"
            return error(`A definição do ${name} é inválida, porque possui mais do que uma referência ${plural} de atributos '${repeated_attrGroups.join("', '")}'!`)
        }

        // a base do novo CT passa a ser a base do CT base
        new_child.content[0].attrs.base = base_ext.attrs.base
        // adicionar os atributos do novo simpleContent ao base
        new_child.content[0].content = base_ext.content.concat(new_child.content[0].content)
    }
    else {
        switch (base_ct.content[0].element) {
            case "all": case "choice": case "group": case "sequence":
                // separar os atributos do novo CT do resto do conteúdo
                let new_attrs = new_child.content[0].content.filter(x => x.element.includes("attribute"))
                new_child.content[0].content = new_child.content[0].content.filter(x => !x.element.includes("attribute"))

                // separar os atributos do CT base do resto do conteúdo
                let base_attrs = base_ct.content.filter(x => x.element.includes("attribute"))
                base_ct.content = base_ct.content.filter(x => !x.element.includes("attribute"))

                // verificar que não há atributos repetidos entre os dois CTs
                let checkAttrs = check_repeatedAttributes(new_ct.attrs, base_attrs, new_attrs, attrGroups)
                if ("error" in checkAttrs) return checkAttrs
                else attrGroups = checkAttrs.data

                if (base_ct.content[0].element == "all" && new_child.content[0].content.length > 0) return error("Ao derivar um elemento <all> por extensão, apenas é possível adicionar atributos ao tipo!")
                
                base_ct.content[0].content = base_ct.content[0].content.concat(new_child.content[0].content)
                new_ct.content = base_ct.content.concat(base_attrs).concat(new_attrs)
                
                break
            case "simpleContent":
                let name = "name" in new_ct.attrs ? `complexType '${new_ct.attrs.name}'` : "novo complexType"

                let type
                if ("mixed" in new_ct.attrs && new_ct.attrs.mixed && (!("mixed" in new_ct.content[0].attrs) || new_ct.content[0].attrs.mixed)) type = "mixed"
                else type = ("mixed" in new_ct.content[0].attrs && new_ct.content[0].attrs.mixed) ? "mixed" : "element-only"

                return error(`O tipo derivado e da sua base devem ambos ter conteúdo 'mixed' ou 'element-only'. Neste caso, o ${name} é '${type}', mas o tipo base '${base_ct.attrs.name}' não!`)
        }
    }
    
    return data({new_ct, attrGroups})
}

// verificar se há atributos com o mesmo nome no novo complexType e no complexType base
function check_repeatedAttributes(ct_attrs, base_attrs, new_attrs, attrGroups) {
    let name = "name" in ct_attrs ? `'${ct_attrs.name}'` : "novo"

    let base_names = base_attrs.map(x => {return {element: x.element, name: x.attrs["name" in x.attrs ? "name" : "ref"]}})
    let new_names = new_attrs.map(x => {return {element: x.element, name: x.attrs["name" in x.attrs ? "name" : "ref"]}})
    
    let repeated = base_names.filter(v => new_names.some(x => x.element == v.element && x.name == v.name))
    if (repeated.length > 0) {
        let repeated_attrs = repeated.filter(x => x.element == "attribute").map(x => x.name)
        let repeated_groups = repeated.filter(x => x.element == "attributeGroup").map(x => x.name)
        
        if (repeated_attrs.length > 0) return error(`Os elementos <attribute> locais de um elemento devem ter todos nomes distintos entre si! Neste caso, o <complexType> ${name} tem atributos repetidos com os nomes '${repeated_attrs.join("', '")}'.`)
        if (repeated_groups.length > 0) return error(`Os elementos <attribute> locais de um elemento devem ter todos nomes distintos entre si! Neste caso, tanto o <complexType> ${name} como o seu tipo base referenciam os mesmos grupos de atributos '${repeated_groups.join("', '")}'.`)
    }
    else attrGroups = attrsAPI.addAttrGroup(attrGroups, "name" in ct_attrs ? ct_attrs.name : null, "complexType", base_attrs.concat(new_attrs))

    return data(attrGroups)
}

// determinar o nome e prefixo de schema do tipo em questão e o nome da sua base embutida
/* operacional apenas para tipos da schema local */
function getTypeInfo(type, simpleTypes, complexTypes, default_prefix) {
    let builtin_types = stAPI.built_in_types(simpleTypes)
    let base = null // nome do tipo embutido em questão ou em qual é baseado o tipo atual
    let prefix = null, complex = false
 
    if (type.includes(':')) {
      let split = type.split(':')
      type = split[1] // remover o prefixo do nome do tipo
      prefix = split[0]
    }
    // tipo embutido ou local desta schema
    else prefix = default_prefix
 
    // é um tipo da schema local
    if (prefix == default_prefix) {
       if (Object.keys(complexTypes).includes(type)) complex = true
       // se não for embutido, é possível encontrar a sua base embutida na estrutura simpleTypes
       else base = builtin_types.includes(type) ? type : simpleTypes[type].built_in_base
    }
 
    return {type, complex, base, prefix}
}

// derivar um complexType por restrição
function restrict(new_ct, simpleTypes, complexTypes, default_prefix) {
    if (new_ct.content[0].element == "simpleContent") return restrictSC(new_ct, simpleTypes, complexTypes, default_prefix)
    return restrictCC(new_ct, complexTypes)
}

// derivar um complexType com simpleContent por restrição
function restrictSC(new_ct, simpleTypes, complexTypes, default_prefix) {
    let union = false, base_st
    let base = getTypeInfo(new_ct.content[0].content[0].attrs.base, simpleTypes, complexTypes, default_prefix)
    
    if (!base.complex) {
        base_st = JSON.parse(JSON.stringify(simpleTypes[base.type]))        
        if (!["built_in_base","list","union"].some(x => x in base_st)) base_st.built_in_base = base.base
        base = base.base
    }
    else {
        let base_ct = complexTypes[base.type]
        base_st = simpleTypes[base_ct.content[0].content[0].attrs.base]
        base = base_st.built_in_base
    }
    
    if (stAPI.isObject(base_st.built_in_base) && "union" in base_st.built_in_base) base = base_st.built_in_base
    if ("union" in base_st) union = true

    // quando é restrição a uma union, não precisa de verificar as facetas aqui porque o faz depois, numa função específica para unions
    if (!union) {
        let facets = stAPI.check_restrictionST_facets(base, new_ct.content[0].content[0].content, default_prefix, simpleTypes)
        if ("error" in facets) return facets
        return data({built_in_base: base, content: facets.data})
    }

    return data(new_ct)
}

// derivar um complexType com complexContent por restrição
function restrictCC(new_ct, complexTypes) {
    let restriction = new_ct.content[0].content[0]
    let base = restriction.attrs.base

    // feito à preguiçoso, só funciona para schema local!
    if (base.includes(":")) base = base.split(":")[1]
    
    // encontrar o complexType base referenciado na derivação do novo
    let base_ct = complexTypes[base]
    if (base_ct === undefined) return error(`O <complexType> '${base}' referenciado na base da derivação não existe!'`)
    
    let name_ct = "name" in new_ct.attrs ? `complexType '${new_ct.attrs.name}'` : "novo complexType"

    // complexType base tem conteúdo vazio
    if (!base_ct.content.length || !["group","all","choice","sequence"].includes(base_ct.content[0].element)) {
        if (restriction.content.length > 0 && ["group","all","choice","sequence"].includes(restriction.content[0].element))
            return error(`A definição do ${name_ct} é inválida, pois o elemento filho <${restriction.content[0].element}> não pertence ao tipo base.`)
    }

    if (!restriction.content.length || !["group","all","choice","sequence"].includes(restriction.content[0].element)) {
        if (!("minOccurs" in base_ct.content[0].attrs && !base_ct.content[0].attrs.minOccurs))
            return error(`A definição do ${name_ct} é inválida, pois o conteúdo deste tipo é vazio, mas o conteúdo do tipo base '${base}' não é nem pode ser vazio.`)
    }

    let err_msg = error(`A definição do ${name_ct} é inválida, porque não há um mapeamento funcional completo entre as partículas do tipo base e do novo tipo.`)

    let check = validateRestrictionCC(base_ct.content[0], restriction.content[0], err_msg)
    if ("error" in check) return check
    else restriction.content[0] = check.data

    let checkAttrs = validateRestrictionAttrsCC(base_ct.content, restriction.content, name_ct)
    if ("error" in checkAttrs) return checkAttrs
    else restriction.content = checkAttrs.data

    new_ct.content = restriction.content
    return data(new_ct)
}

function validateRestrictionAttrsCC(b, r, name_ct) {
    let match = [], new_r = [r[0]]

    for (let i = 1; i < b.length; i++) {
        let prop = "name" in b[i].attrs ? "name" : "ref"

        // índice deste atributo na restrição
        let index = r.findIndex(x => x.element == "attribute" && prop in x.attrs && x.attrs[prop] == b[i].attrs[prop])
        if (index != -1) {
            match.push(index)
            if ("fixed" in b[i].attrs && !("fixed" in r[index].attrs)) return error(`A definição do ${name_ct} é inválida. O valor do atributo '${b[i].attrs[prop]}' neste novo tipo não é fixado, o que contradiz o tipo base que está a derivar, cujo valor do respetivo atributo é fixado a '${b[i].attrs.fixed}'!`)
            if ("fixed" in b[i].attrs && r[index].attrs.fixed != b[i].attrs.fixed) return error(`A definição do ${name_ct} é inválida. O valor do atributo '${b[i].attrs[prop]}' neste novo tipo é fixado a '${r[index].attrs.fixed}', o que contradiz o tipo base que está a derivar, cujo valor do respetivo atributo é fixado a '${b[i].attrs.fixed}'!`)

            new_r.push(r[index])
        }
        else new_r.push(b[i])
    }

    if (r.length-1 > match.length) {
        match.push(0)
        let attrs = r.filter((x,i) => !match.includes(i)).map(x => "name" in x.attrs ? x.attrs.name : x.attrs.ref)
        return error(`A definição do ${name_ct} é inválida. Os atributos '${attrs.join("', '")}' da restrição não correspondem a atributos do tipo base!`)
    }

    return data(new_r)
}

function validateRestrictionCC(base_el, new_el, err_msg) {
    let prohib = (base, arr) => error(`Só é permitido derivar por restrição um elemento <${base}> com um elemento <${arr.join(">, <").replace(/,([^,]*)$/, " ou" + '$1')}>!`)

    if (base_el.element == "element") {
        if (new_el.element != "element") return err_msg
        if (base_el.attrs.name != new_el.attrs.name) return err_msg

        let occurRange = ocurrenceRange(base_el, new_el, null, null)
        if ("error" in occurRange) return occurRange

        let eltRest = checkEltRestriction(base_el, new_el, err_msg)
        if ("error" in eltRest) return eltRest

        if ("type" in base_el.attrs && !("type" in new_el.attrs)) new_el.attrs.type = base_el.attrs.type
        if (base_el.content.length > 0 && !new_el.content.length) new_el.content = base_el.content
    }

    if (base_el.element == "all") {
        let occurRange = ocurrenceRange(base_el, new_el, null, null)
        if ("error" in occurRange) return occurRange

        if (new_el.element == "all") {
            let check = orderedPreservationBtoR(base_el.content, new_el.content, err_msg)
            if ("error" in check) return check
            else new_el.content = check.data
        }
        else if (new_el.element == "sequence") {
            let check = unorderedPreservation(base_el.content, new_el.content, err_msg)
            if ("error" in check) return check
            else new_el.content = check.data
        }
        else return prohib("all", ["all", "sequence"])
    }

    if (base_el.element == "sequence") {
        let occurRange = ocurrenceRange(base_el, new_el, null, null)
        if ("error" in occurRange) return occurRange

        if (new_el.element == "sequence") {
            let check = orderedPreservationBtoR(base_el.content, new_el.content, err_msg)
            if ("error" in check) return check
            else new_el.content = check.data
        }
        else return prohib("sequence", ["sequence"])
    }

    if (base_el.element == "choice") {
        if (new_el.element == "choice" || new_el.element == "sequence") {
            let check = orderedPreservationRtoB(base_el.content, new_el.content, err_msg)
            if ("error" in check) return check
            else new_el.content = check.data
            
            if (new_el.element == "choice") {
                let occurRange = ocurrenceRange(base_el, new_el, null, null)
                if ("error" in occurRange) return occurRange
            }
            if (new_el.element == "sequence") {
                let length = particlesLength(new_el, 0)
                let minOccurs = new_el.attrs.minOccurs * length
                let maxOccurs = new_el.attrs.maxOccurs == "unbounded" ? "unbounded" : (new_el.attrs.maxOccurs * length)

                let occurRange = ocurrenceRange(base_el, new_el, minOccurs, maxOccurs)
                if ("error" in occurRange) return occurRange
            }
        }
        else return prohib("choice", ["choice", "sequence"])
    }

    return data(new_el)
}

function particlesLength(el, len) {
    for (let i = 0; i < el.content.length; i++) {
        if (["element","choice"].includes(el.content[i].element)) len++
        else len = particlesLength(el.content[i], len)
    }
    return len
}

function ocurrenceRange(base_el, new_el, r_minOccurs, r_maxOccurs) {
    let choiceSeq = r_minOccurs !== null
    let err = msg => error(!choiceSeq ? msg : `O 'range' de ocorrência do grupo de elementos da restrição, (${r_minOccurs},${r_maxOccurs}), não é uma restrição válida do 'range' de ocorrência do grupo de elementos base, (${base_el.attrs.minOccurs},${base_el.attrs.maxOccurs})!`)

    if (r_minOccurs === null) r_minOccurs = new_el.attrs.minOccurs
    if (r_maxOccurs === null) r_maxOccurs = new_el.attrs.maxOccurs

    if (!(r_minOccurs >= base_el.attrs.minOccurs)) return err(`Ao derivar um <${base_el.element}> por restrição, o atributo 'minOccurs' do novo elemento deve ser >= que o do elemento base.`)
    if (!(base_el.attrs.maxOccurs == "unbounded" || (r_maxOccurs != "unbounded" && r_maxOccurs <= base_el.attrs.maxOccurs)))
        return err(`Ao derivar um <${base_el.element}> por restrição, ou o atributo 'maxOccurs' do elemento base é "unbounded", ou tanto 'maxOccurs' do elemento base como do novo são números e 'maxOccurs' do novo é <= que o do elemento base.`)
    return data(true)
}

function checkEltRestriction(b, r, err_msg) {
    if (!(b.attrs.nillable || !r.attrs.nillable)) return err_msg
    if (!(!("fixed" in b.attrs) || ("fixed" in r.attrs && r.attrs.fixed == b.attrs.fixed))) return err_msg
    return data(true)
}

function orderedPreservationBtoR(b, r, err_msg) {
    if (b.length != r.length) return err_msg

    for (let i = 0; i < b.length; i++) {
        if (b[i].element != r[i].element) return err_msg
        
        let check = validateRestrictionCC(b[i], r[i], err_msg)
        if ("error" in check) return check
        else r[i] = check.data
    }

    return data(r)
}

function orderedPreservationRtoB(b, r, err_msg) {
    let stopWhile = (i,j) => i == b.length || b[i].element == r[j].element && (b[i].element != "element" || b[i].attrs.name == r[j].attrs.name)

    for (let i = 0, j = 0; j < r.length; j++) {
        while (!stopWhile(i,j)) i++
        if (i == b.length) return err_msg

        let check = validateRestrictionCC(b[i], r[j], err_msg)
        if ("error" in check) {
            if (b[i].element == "element" || i == b.length-1) return check
            else j--
        }
        else r[j] = check.data

        i++
    }

    return data(r)
}

function unorderedPreservation(b, r, err_msg) {
    if (b.length != r.length) return err_msg

    for (let i = 0; i < b.length; i++) {
        let index = r.findIndex(x => x.attrs.name == b[i].attrs.name)
        if (index == -1) return err_msg
        
        let check = validateRestrictionCC(b[i], r[index], err_msg)
        if ("error" in check) return check
        else r[index] = check.data
    }

    return data(r)
}

function emptiable(content) {
    for (let i = 0; i < content.length; i++) {
        if (!content[i].element.includes("ttribute") && content[i].attrs.minOccurs != 0) {
            if (content[i].element == "element") return false
            if (!emptiable(content[i].content)) return false
        }
    }
    return true
}

function validateBaseRestrictionSC(base_ct) {
    let error_msg = "A definição do novo complexType é inválida. Quando <simpleContent> é usado, o tipo base deve ser um complexType cujo tipo do conteúdo seja simples, ou, apenas se for especificada uma restrição, um complexType com conteúdo 'mixed' e partículas esvaziáveis, ou, apenas se for especificada uma extensão, um simpleType. O novo complexType não satisfaz nenhuma destas condições!"

    if ("mixed" in base_ct.attrs && base_ct.attrs.mixed && emptiable(base_ct.content)) return data(true)
    return error(error_msg)
}

function copyRefs(base_ct, original) {
    for (let i = 0; i < base_ct.content.length; i++) {
        if (["all","choice","sequence","group"].includes(base_ct.content[i].element)) base_ct.content[i] = copyRefs(base_ct.content[i], original.content[i])
        if (base_ct.content[i].element == "element") base_ct.content[i] = original.content[i]
        if (base_ct.content[i].element.includes("ttribute")) base_ct.content[i] = original.content[i]
    }

    return base_ct
}

module.exports = {
    extend,
    restrict,
    validateBaseRestrictionSC,
    copyRefs
}