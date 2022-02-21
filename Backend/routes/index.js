var express = require('express');
var router = express.Router();
var axios = require('axios');

var fs = require('fs');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

const parser = require('../grammar/parser')
const converter = require('../converter/converter')

// POST para gerar um dataset a partir de um XML schema
router.post('/xml_schema', (req, res) => {
  try {
    let data = parser.parse(req.body.xsd)
    //console.log(JSON.stringify(data))
    
    for (let i = 0; i < data.unbounded_min; i++) {
      if (data.unbounded_min[i] > req.body.settings.UNBOUNDED) {
        let message = `Um elemento na schema tem minOccurs='${data.unbounded_min[i]}' e maxOccurs='unbounded', o que é inválido porque o máximo de repetições geráveis está definido como '${req.body.unbounded}'.`
        return res.status(201).jsonp({message})
      }
    }

    let model = converter.convertXSD(data.xsd, data.simpleTypes, data.complexTypes, req.body.settings)
    let path = `./output/${uuidv4()}.txt`

    try {
      fs.writeFileSync(path, model)
      console.log(`Modelo DataGen guardado em ${path.slice(2)}!`)
    }
    catch(err) { console.log(err) }

    const formData = new FormData()
    formData.append('output_format', req.body.settings.OUTPUT)
    formData.append('xml_declaration', data.xml_declaration)
    formData.append('model', fs.createReadStream(path), {
      filename: "model.txt",
      contentType: "text/plain"
    })
    
    axios.post("http://localhost:12080/api/datagen/dfs", formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
      .then(data => {
        data = req.body.settings.OUTPUT == "XML" ? data.data : JSON.stringify(data.data, null, 3)
        fs.unlink(path, err => { if (err) console.log(`Ocorreu um erro ao eliminar o modelo ${path.slice(2)}.`) })
        res.status(201).jsonp(data)
      })
      .catch(err => {console.log("catch"); res.status(201).jsonp(err)})

  } catch (err) {res.status(201).jsonp(err)}
});

module.exports = router;
