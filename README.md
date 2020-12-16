# obj-annotations-converter

Converts object detection annotations in multiple formats

Supported formats:
- Pascal VOC XML
- IBM Watson Visual Recognition Json
- cloud.annotations.ai Json
- Maximo Visual Inspection import dataset format (custom XML VOC-like with additional prop.json file)

Useful when you have preexisting annotations and want to play with 
[IBM Watson Visual Recognition APIs](https://cloud.ibm.com/apidocs/visual-recognition/visual-recognition-v4), 
[Cloud Annotations](https://cloud.annotations.ai/) 
[Maximo Visual Inspection](https://www.ibm.com/products/ibm-maximo-visual-inspection)
or Tensorflow 

Supported scenarios:
- from watson to voc
- from voc to watson
- from watson to cloud annotation
- from cloud annotation to watson
- from watson to mvi
- from voc to mvi

#### TO DO:
- implement voc to cloud annotations conversion
- implement cloud annotations to voc conversion
- implement mvi to watson conversion
- implement mvi to voc conversion

---

#### Installation:

To install this program, just run

```
npm install
npm link
```

then you'll be able to use obj-annotations-converter from a shell.

---

#### Usage:
```
Usage: obj-annotations-converter --from watson --to voc --source . --target ./annotations

Options:
  -V, --version     output the version number
  --from <type>     Set annotation origin format [watson, voc, ca] (default: "watson")
  --to <type>       Set annotation destination format [watson, voc, ca, mvi] (default: "voc")
  --source <src>    origin directory
  --target <dst>    target directory
  --dataset <name>  dataset name (needed only when converting to mvi)
  -h, --help        display help for command
```

---

#### Examples:
```
    obj-annotations-converter --from watson --to voc --source ./annotations-watson --target ./annotations-voc
    obj-annotations-converter --from voc --to watson --source ./annotations-voc --target ./annotations-watson
    obj-annotations-converter --from watson --to ca --source ./annotations-watson --target ./annotations-ca
    obj-annotations-converter --from ca --to watson --source ./annotations-ca --target ./annotations-watson
    obj-annotations-converter --from watson --to mvi --source ./annotations-watson --target ./annotations-mvi --dataset "name"
    obj-annotations-converter --from voc --to mvi --source ./annotations-voc --target ./annotations-mvi --dataset "name"
```
