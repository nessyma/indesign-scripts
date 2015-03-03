#include "libs/json2.js" // jshint ignore:line
// #include "libs/lodash.js" // jshint ignore:line
// #include "libs/async.js" // jshint ignore:line

main();

function main() {
    // var filepath = "~/Desktop/test.json";
    // var write_file = File(filepath);

    var folder = Folder.selectDialog ("Select a folder");
    if(folder !== null){
        var filesArr = folder.getFiles ('*.indd');
        var file, fileFolder, dataStr, doc;
        for (var i = 0; i < filesArr.length; i++) {
          file = filesArr[i];

          // prepare folder and json file
          fileFolder = new Folder(file.fullName.split('.')[0]);
          fileFolder.create();

          // doc
          doc = app.open(file, true);

          // ratio to fit exactly in 920x475
          var ratio = exportRatio(doc, 920, 475);

          exportOriginal(doc, ratio, fileFolder+'/original.png');

          // bg
          exportBackground(doc, fileFolder+'/bg.png');

          var infos = {};
          //prefs
          infos.prefs = exportAppPrefs();
          infos.prefs.ratio = ratio;

          // text
          infos.texts = exportTexts(doc, ratio);
          // overlay
          infos.overlay = exportOverlays(doc, ratio, fileFolder+'/overlay-placeholder');

          writeJsonFile(fileFolder.fullName+'/data.json', JSON.stringify(infos));

        }
    }
}

function exportOverlays(doc, ratio, path) {
  var arr = [];
  doc.layers.everyItem().visible = false;
  var photoLayer =  doc.layers.itemByName('_photos');
  if(photoLayer.isValid) {
    photoLayer.visible = true;
    var rObj, bounds, element;
    for (var i = 0; i < photoLayer.rectangles.length; i++) {
      element = {
        id: 'photo'+i,
        original: {},
        user:{}
      };
      rObj = element.original;
      bounds = photoLayer.rectangles[i].geometricBounds;
      rObj.bounds = {
        x: bounds[1] *ratio, 
        y: bounds[0] *ratio, 
        width: (bounds[3] - bounds[1]) *ratio,
        height: (bounds[2] - bounds[0]) *ratio
      };

      // $.writeln('photoLayer.rectangles i  : ', photoLayer.rectangles[i].images[0].itemLink.filePath);
      rObj.src = 'overlay-'+i;

      var file = new File(photoLayer.rectangles[i].images[0].itemLink.filePath);
      var ext = file.displayName.split('.').pop();
      if(file.exists) {
        file.copy(path+i+'.'+ext);
      }
      //$.writeln('photoLayer file.exists  : ', file.exists);

      //var pWeb = photoLayer.rectangles[i].images[0].exportForWeb(new File(path+i+'.jpg'));
      //photoLayer.rectangles[i].images[0].exportFile(ExportFormat.PNG_FORMAT , new File(path+i+'.png'), true);
      //$.writeln('photoLayer.rectangles pWeb  : ', pWeb);

      arr.push(element);
    }

  } else {
    return false;
  }
  return arr;
}

function exportTexts(doc, ratio) {
  var arr = [];
  doc.layers.everyItem().visible = false;
  var textLayer =  doc.layers.itemByName('_textes');
  if(textLayer.isValid) {
    textLayer.visible = true;
    $.writeln('textLayer.textFrames.length : ', textLayer.textFrames.length);
    
    var txtFrame, rObj, bounds, element;
    for (var i = 0; i < textLayer.textFrames.length; i++) {
      txtFrame = textLayer.textFrames[i];
      element = {
        id: 'txt'+i,
        original: {},
        user:{}
      };

      rObj = element.original;
      rObj.text =  escape(txtFrame.contents);
      bounds = txtFrame.geometricBounds;
      rObj.bounds = {
        x: bounds[1] *ratio, 
        y: bounds[0] *ratio, 
        width: (bounds[3] - bounds[1]) *ratio,
        height: (bounds[2] - bounds[0]) *ratio
      };
      // $.writeln('txtFrame fontStyle: ', txtFrame.textStyleRanges[0].fontStyle);
      // $.writeln('txtFrame appliedFont.fontFamily: ', txtFrame.texts[0].appliedFont.fontFamily);
      // $.writeln('txtFrame appliedFont.fontStyleName: ', txtFrame.texts[0].appliedFont.fontStyleName);
      // $.writeln('txtFrame appliedFont.fontStyleNameNative: ', txtFrame.texts[0].appliedFont.fontStyleNameNative);
      // $.writeln('txtFrame appliedFont.fullName: ', txtFrame.texts[0].appliedFont.fullName);
      // $.writeln('txtFrame appliedFont.fullNameNative: ', txtFrame.texts[0].appliedFont.fullNameNative);
      // $.writeln('txtFrame pointSize: ', txtFrame.texts[0].pointSize);
      // $.writeln('txtFrame characterAlignment: ', txtFrame.texts[0].characterAlignment);
      //$.writeln('txtFrame characterAlignment: ', txtFrame.texts[0].justification);
      // $.writeln('1P txtFrame fillColor: ', txtFrame.texts[0].fillColor.colorValue);
      var color = txtFrame.texts[0].fillColor;
      color.space = ColorSpace.RGB;
      var hex = rgbToHex.apply(this, color.colorValue);
      rObj.fontFamily = txtFrame.texts[0].appliedFont.fontFamily;
      rObj.fontStyleName = txtFrame.texts[0].appliedFont.fontStyleName;
      rObj.pointSize = txtFrame.texts[0].pointSize *ratio;
      rObj.verticalAlign = exportAlign(txtFrame.texts[0].characterAlignment);
      rObj.horizontalAlign = exportJustification(txtFrame.texts[0].justification);
      rObj.color = hex;
      arr.push(element);
    }
  } else {
    return false;
  }
  return arr;
}

function exportAlign(align) {
  // CharacterAlignment.ALIGN_BASELINE
  // CharacterAlignment.ALIGN_EM_TOP
  // CharacterAlignment.ALIGN_EM_CENTER
  // CharacterAlignment.ALIGN_EM_BOTTOM
  // CharacterAlignment.ALIGN_ICF_TOP
  // CharacterAlignment.ALIGN_ICF_BOTTOM
  return align.toString();
}

function exportJustification(justif) {
  return justif.toString();
// Justification.LEFT_ALIGN
// Justification.CENTER_ALIGN
// Justification.RIGHT_ALIGN
// Justification.LEFT_JUSTIFIED
// Justification.RIGHT_JUSTIFIED
// Justification.CENTER_JUSTIFIED
// Justification.FULLY_JUSTIFIED
// Justification.TO_BINDING_SIDE
// Justification.AWAY_FROM_BINDING_SIDE
}

function exportOriginal(doc, ratio, fullName) {
  doc.layers.everyItem().visible = true;
  if (!doc.saved) { doc.save(); }
  alert('Preciser la resolution suivante [ '+ Math.round(ratio*72) +' ] dans la fenêtre d\'option d\'export');
  doc.exportFile(ExportFormat.PNG_FORMAT , new File(fullName), true);
}

function exportBackground(doc, fullName) {
  // prefs d'export en 'read only'. Il faut faire un premiere export pour setter les paramètres désirés
  doc.layers.everyItem().visible = false;
  var bgLayer =  doc.layers.itemByName('_fond');
  if(bgLayer.isValid) {
      bgLayer.visible = true;
    if (!doc.saved) { doc.save(); }
    doc.exportFile(ExportFormat.PNG_FORMAT , new File(fullName), false);
  } else {
    return false;
  }
}

function exportRatio(doc, destW, destH) {
  var origW = doc.pages[0].bounds[3];
  var origH = doc.pages[0].bounds[2];
  var destRatio = destW / destH;
  var origRatio = origW / origH;
  var scaleRatio = (origRatio < destRatio) ? ( destH / origH ) : ( destW / origW ) ;
  return 1;
}

function exportAppPrefs() {
  var obj = {};
  obj.xUnitsIsPixel = (app.viewPreferences.horizontalMeasurementUnits == MeasurementUnits.PIXELS);
  obj.yUnitsIsPixel = (app.viewPreferences.verticalMeasurementUnits == MeasurementUnits.PIXELS);
  if(!obj.xUnitsIsPixel || !obj.yUnitsIsPixel) {
    $.writeln('Fermer toutes les documents ouverts dans Indesign et changer les prefs "Units and roulers" pour PIXELS. Ainsi ce seront les prefs par defaut');
  }
  return obj;
}

function writeJsonFile(fullName, dataStr) {
  var write_file = new File(fullName);

  var out = write_file.open('w', undefined, undefined);
  write_file.encoding = "UTF-8";
  write_file.lineFeed = "Unix"; //convert to UNIX lineFeed
  write_file.writeln(dataStr);
  write_file.close();
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
