
#include "libs/json2.js" // jshint ignore:line

Error.prototype.toString = function() {
    if (typeof this.stack === "undefined" || this.stack === null) {
        this.stack = "placeholder";
        // The previous line is needed because the next line may indirectly call this method.
        this.stack = $.stack;
    }
    return "Error";
};

var ratio = 1;

try {
  main();
} catch (e) {
  alert('[Error] \n\r Line: ' + e.line + '\n\r Message: ' + e.message);
  $.writeln("Line: " + e.line);
  $.writeln("File: " + e.fileName);
  $.writeln("Message: " + e.message);
  $.writeln("Stack: " + e.stack);
}

function main() {
  // var filepath = "~/Desktop/test.json";
  // var write_file = File(filepath);

  // PREPARE APP
  // ratio to fit exactly in 920x475
  //var ratio = exportRatio(doc, 920, 475);
  ratio = prompt("Choose the export ratio:", "1.5");
  // si cancel : w: 920 max. h : 600 max.  

  // PARSE FOLDER

  var folder = Folder.selectDialog("Select a folder");

  if (folder !== null) {

    var filesArr = folder.getFiles('*.indd');
    var folderArr = folder.getFiles(isFolder);
    var nbIndd = 0;

   
    var firstDoc = true;
    for (var i = 0; i < filesArr.length; i++) {
      exportDocument(filesArr[i], firstDoc);
      nbIndd++;
    }

    for (var j = 0; j < folderArr.length; j++) {

       filesArr = folderArr[j].getFiles('*.indd');
  
      $.writeln('folderArr /  filesArr : ', filesArr.length);
      
      for (var k = 0; k < filesArr.length; k++) {
        exportDocument(filesArr[k], firstDoc);
        nbIndd++;
       }
   
    }

    if (!nbIndd) {
      alert('Aucun fichier indesign trouvé.');
    } else {
       alert('L\'export est terminé. '+nbIndd+' traités');
    }

    
  }
}

function isFolder(folder) {
  return folder && folder.getFiles;
}

function exportDocument(file, firstDoc) {

  var fileFolder, dataStr, doc;
  // prepare folder and json file
  fileFolder = file.fsName.substr(0, file.fsName.lastIndexOf('.'));
  fileFolder = new Folder(fileFolder.split('.')[0]);
  fileFolder.create();

  ratio = (ratio || exportRatio(doc, 920, 650));

  // doc
  try {
     doc = app.open(file, true);
      exportOriginal(doc, ratio, fileFolder + '/original.png', firstDoc);
      firstDoc = false;

      // bg
      exportBackground(doc, fileFolder + '/bg.png', firstDoc);

      var infos = {};
      //prefs
      infos.prefs = exportPrefs(doc);
      infos.prefs.ratio = ratio;

      // graphics
      infos.backgrounds = exportBackgrounds(doc, fileFolder, firstDoc);

      // graphics
      infos.graphics = exportGraphics(doc, ratio, fileFolder, firstDoc);
      // text
      infos.texts = exportTexts(doc, ratio);
      // overlay
      infos.overlay = exportOverlays(doc, ratio, fileFolder, firstDoc);

      writeJsonFile(fileFolder.fsName + '/data.json', JSON.stringify(infos));
  } catch (e) {
    alert('Une problème empêche le document de s\'ouvrir. '+ e.message);
  }

}


function exportBackgrounds(doc, path, firstDoc) {

  // prefs d'export en 'read only'. Il faut faire un premiere export pour setter les paramètres désirés
  
  var first = firstDoc;

  var arr = [];
  var layer, layerName, fileName, element, rObj, name;
  var count = doc.layers.count();

  for (var i = 0; i < count; i++) {
    layer = doc.layers[i];
    doc.layers.everyItem().visible = false;
    if(layer.name.indexOf('fond') >= 0) {
      layerName = layer.name;
      layer.visible = true;
      doc.save();

      name = 'background' + i;

      element = {
        id: name
      };

      fileName = name +'.png';
      element.color = layerName.split('/')[1];
      element.src = fileName;

      //$.writeln('exportBackgrounds rObj.color : ', rObj.color);

      doc.exportFile(ExportFormat.PNG_FORMAT, new File(path + '/' + fileName), first);
      first = false;
      arr.push(element);
    }
  }

  return arr;

}

function exportOverlays(doc, ratio, path, firstDoc) {

  var arr = [];
  doc.layers.everyItem().visible = false;
  var photoLayer = doc.layers.itemByName('_photos');

  if (photoLayer.isValid) {
    photoLayer.visible = true;
    var rObj, bounds, element, imageBounds;
    for (var i = 0; i < photoLayer.rectangles.length; i++) {
      element = {
        id: 'photo' + i,
        original: {},
        user: {}
      };
      rObj = element.original;

      bounds = photoLayer.rectangles[i].geometricBounds;

      rObj.bounds = getHtmlBounds(bounds, ratio);
      rObj.imageBounds = undefined;
      rObj.verticalScale = undefined;
      rObj.horizontalScale = undefined;
      rObj.src = undefined;

      var image = photoLayer.rectangles[i].images[0];
      if (image !== undefined) {
        imageBounds = image.geometricBounds;
        rObj.imageBounds = getHtmlBounds(imageBounds, ratio);

        rObj.verticalScale = image.verticalScale;
        rObj.horizontalScale = image.horizontalScale;

        var file = new File(image.itemLink.filePath);
        var ext = file.displayName.split('.').pop();
        var fileName = 'overlay-' + i + '.' + ext;
        if (file.exists) {
          
          file.copy(path+'/'+fileName);
          rObj.src = fileName;
        }
    
        //$.writeln('file : ', path+'/'+fileName);
        //$.writeln('rObj.src : ', rObj.src);

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

function exportGraphics(doc, ratio, path, firstDoc) {

  var folderName = 'icons';
  var fileFolder = new Folder(path+'/'+folderName);
  fileFolder.create();

  var arr = [];
  doc.layers.everyItem().visible = false;

  var graphicsLayer = doc.layers.itemByName('_graphics');

  if (graphicsLayer.isValid) {
    graphicsLayer.visible = true;
    var rObj, element, group, bounds, htmlBounds, newDoc, name, fileName, fullFileName, layerFolder;

    var firstBloc = firstDoc;

    for (var i = 0; i < graphicsLayer.groups.count(); i++) {

      name = 'graphic' + i;
      layerFolder = new Folder(path+'/'+folderName+'/'+name);
      layerFolder.create();

      element = {
        id: name,
        original: {},
        user: {}
      };
      rObj = element.original;
      group = graphicsLayer.groups[i];
      bounds = group.visibleBounds;
      htmlBounds = getHtmlBounds(bounds, ratio);
      element.bounds = htmlBounds;
      element.list = [];

      if(group.isValid) {
        // start : export du graphic par defaut
        //$.writeln('group : ', group);
        group.select(SelectionOptions.REPLACE_WITH);
        app.copy();
        newDoc = app.documents.add({
          documentPreferences: {
            pageWidth: Math.ceil(bounds[3] - bounds[1]),
            pageHeight: Math.ceil(bounds[2] - bounds[0]),
            marginPreferences: { bottom: 0, top: 0, left: 0, right: 0 }
          }
        });
        app.paste();
        fileName = 'default.png';
        fullFileName = path + '/' + folderName + '/' +  name + '/' + fileName;
        //$.writeln('fullFileName : ', fullFileName);
        newDoc.exportFile(ExportFormat.PNG_FORMAT, new File(fullFileName), true);
        newDoc.close(SaveOptions.NO);
        rObj.src = fileName;
        element.list.push(fileName);
        // end : export du graphic par defaut
        arr.push(element);
        firstBloc = false;
      }
     
    }

  } else {
    return false;
  }
  return arr;
}

function exportTexts(doc, ratio) {
  var arr = [];
  doc.layers.everyItem().visible = false;
  var textLayer = doc.layers.itemByName('_textes');
  if (textLayer.isValid) {
    textLayer.visible = true;
    //$.writeln('textLayer.textFrames.length : ', textLayer.textFrames.length);

    var txtFrame, rObj, bounds, element;
    for (var i = 0; i < textLayer.textFrames.length; i++) {
      txtFrame = textLayer.textFrames[i];
      element = {
        id: 'txt' + i,
        original: {},
        user: {}
      };

      rObj = element.original;
      rObj.text = escape(txtFrame.contents);

      bounds = txtFrame.geometricBounds;
      rObj.bounds = getHtmlBounds(bounds, ratio);

      rObj.multiline = Boolean(txtFrame.lines.count() > 1);

      // rObj.bounds = {
      //   x: bounds[1] * ratio,
      //   y: (bounds[0] * ratio) - (txtFrame.texts[0].ascent * ratio),
      //   width: (bounds[3] - bounds[1]) * ratio,
      //   height: (bounds[2] - bounds[0]) * ratio + (txtFrame.texts[0].ascent * ratio) + (txtFrame.texts[0].descent * ratio)
      // };

      // $.writeln('txtFrame fontStyle: ', txtFrame.textStyleRanges[0].fontStyle);
      // $.writeln('txtFrame appliedFont.fontFamily: ', txtFrame.texts[0].appliedFont.fontFamily);
      // $.writeln(': ', txtFrame.texts[0].appliedFont.fontStyleName);
      // $.writeln('txtFrame appliedFont.fontStyleNameNative: ', txtFrame.texts[0].appliedFont.fontStyleNameNative);
      // $.writeln('txtFrame appliedFont.fsName: ', txtFrame.texts[0].appliedFont.fsName);
      // $.writeln('txtFrame appliedFont.fullNameNative: ', txtFrame.texts[0].appliedFont.fullNameNative);
      // $.writeln('txtFrame pointSize: ', txtFrame.texts[0].pointSize);
      // $.writeln('txtFrame characterAlignment: ', txtFrame.texts[0].characterAlignment);
      //$.writeln('txtFrame characterAlignment: ', txtFrame.texts[0].justification);
      //$.writeln('1P txtFrame fillColor: ', txtFrame.texts[0].fillColor.colorValue);
      //$.writeln('1P txtFrame color space : ', txtFrame.texts[0].fillColor.space);
      
      var color = txtFrame.texts[0].fillColor;
      var hex = '#000000';
      if(!color) {
          alert("L'element dont le texte \""+rObj.text+"\" est n'a pas de couleur.");
      } else {
           if(color.space == ColorSpace.CMYK) {
            hex = cmykToHex.apply(this, color.colorValue);
            //$.writeln('ColorSpace.CMYK : '+ rObj.text+' = '+hex);
          } else if(color.space == ColorSpace.RGB) {
            hex = rgbToHex.apply(this, color.colorValue);
           //$.writeln('ColorSpace.RGB : '+ rObj.text+' = '+hex);
          } else {
            alert("Le colorspace n'est ni en RVB ni en CMYK, le texte sera noir.");
          }
      }

      /** /
      try {
       rObj.fontFile = txtFrame.texts[0].appliedFont.location.split('/').pop();
      } catch(e) {
       alert('Une erreur est survenue concernant les elements textes \n\r', e.message, ' \n\r en ligne : ', e.line);
      }
      /**/
      
      try {
        rObj.fontFamily = txtFrame.texts[0].appliedFont.platformName;
      } catch(e) {
        $.writeln('platformName NOT FOUND for fontFamily: ', txtFrame.texts[0].appliedFont.fontFamily);
        rObj.fontFamily = txtFrame.texts[0].appliedFont.fontFamily;
      }
  
      try {
        rObj.fontStyleName = txtFrame.texts[0].appliedFont.fontStyleName;
      } catch(e) {
        $.writeln('FONT STYLE NOT FOUND for fontFamily: ', txtFrame.texts[0].appliedFont.fontFamily);
        rObj.fontStyleName = "Regular";
      }

      var fw = rObj.fontStyleName.toLowerCase();
      switch(fw) {
        case 'normal':
        case 'bold':
          break;
        case 'regular':
        case 'medium':
          fw = 'normal';
          break;
        default:
          fw = 'normal';
          break;
      }
      rObj.fontWeight = fw;
      
      rObj.pointSize = txtFrame.texts[0].pointSize * ratio;
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

function exportOriginal(doc, ratio, fullName, firstDoc) {
  doc.layers.everyItem().visible = true;
  if (!doc.saved) {
    doc.save();
  }
  if(firstDoc) {
    alert('Preciser la resolution suivante [ ' + Math.round(ratio * 72) + ' ] dans la fenêtre d\'option d\'export');
  }
  doc.exportFile(ExportFormat.PNG_FORMAT, new File(fullName), firstDoc);
}

function exportBackground(doc, fullName, firstDoc) {
  // prefs d'export en 'read only'. Il faut faire un premiere export pour setter les paramètres désirés
  doc.layers.everyItem().visible = false;
  var bgLayer = doc.layers.itemByName('_fond');
  if (bgLayer.isValid) {
    bgLayer.visible = true;
  } 

  if (!doc.saved) {
    doc.save();
  }
  doc.exportFile(ExportFormat.PNG_FORMAT, new File(fullName), firstDoc);

}

function exportRatio(doc, destW, destH) {
/** /
  var origW = doc.pages[0].bounds[3];
  var origH = doc.pages[0].bounds[2];
  var destRatio = destW / destH;
  var origRatio = origW / origH;
  var scaleRatio = (origRatio < destRatio) ? (destH / origH) : (destW / origW);
/**/
  return 1;
}

function exportPrefs(doc) {
  var obj = {};
  obj.xUnitsIsPixel = (doc.viewPreferences.horizontalMeasurementUnits == MeasurementUnits.PIXELS);
  obj.yUnitsIsPixel = (doc.viewPreferences.verticalMeasurementUnits == MeasurementUnits.PIXELS);
  if (!obj.xUnitsIsPixel || !obj.yUnitsIsPixel) {
    alert('Fermer tous les documents ouverts dans Indesign et changer les prefs "Units and roulers" pour PIXELS. Ainsi ce seront les prefs par defaut');
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

function getHtmlBounds(bounds, ratio) {
  return {
        x: bounds[1] * ratio,
        y: (bounds[0] * ratio),
        width: (bounds[3] - bounds[1]) * ratio,
        height: (bounds[2] - bounds[0]) * ratio
      };
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function cmykToHex(c,m,y,k) {
  //$.writeln('c,m,y,k : ', c, ' / ', m, ' / ', y, ' / ', k );

  c /= 100;
  m /= 100;
  y /= 100;
  k /= 100;

  function padZero(str) {
    return "000000".substr(str.length)+str;
  }
  var cyan = (c * 255 * (1-k)) << 16;
  var magenta = (m * 255 * (1-k)) << 8;
  var yellow = (y * 255 * (1-k)) >> 0;
  var black = 255 * (1-k);
  var white = black | black << 8 | black << 16;
  var color = white - (cyan | magenta | yellow );
  return ("#"+padZero(color.toString(16)));
}
