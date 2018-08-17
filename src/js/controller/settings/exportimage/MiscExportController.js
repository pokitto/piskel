(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  var BLACK = '#000000';
  //copied from GifExportController - jonne
  var MAX_GIF_COLORS = 256;
  var MAGIC_PINK = '#FF00FF';
  var WHITE = '#FFFFFF';

  ns.MiscExportController = function (piskelController) {
    this.piskelController = piskelController;
  };

  pskl.utils.inherit(ns.MiscExportController, pskl.controller.settings.AbstractSettingController);

  ns.MiscExportController.prototype.init = function () {
    var cDownloadButton = document.querySelector('.c-download-button');
    this.addEventListener(cDownloadButton, 'click', this.onDownloadCFileClick_);

    var selectedFrameDownloadButton = document.querySelector('.selected-frame-download-button');
    this.addEventListener(selectedFrameDownloadButton, 'click', this.onDownloadSelectedFrameClick_);

    //copied from GifExportController - jonne
    var currentColors = pskl.app.currentColorsService.getCurrentColors();
    var palettes = pskl.app.currentColorsService.paletteService.getPalettes();
    var colors = palettes[1].getColors();
    //var currentColors = pskl.app.currentColorsPalette.getColors();
    var tooManyColors = currentColors.length >= MAX_GIF_COLORS;
    document.querySelector('.gif-export-warning').classList.toggle('visible', tooManyColors);
  };

  ns.MiscExportController.prototype.onDownloadCFileClick_ = function (evt) {
    var fileName = this.getPiskelName_() + '.c';
    var cName = this.getPiskelName_().replace(' ','_');
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Useful defines for C routines
    var frameStr = '#include <stdint.h>\n\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_COUNT ' +  this.piskelController.getFrameCount() + '\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_WIDTH ' + width + '\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_HEIGHT ' + height + '\n\n';

    // Write palette into file
    frameStr += '/* 16-bit (565 rgb) palette data for \"' + this.getPiskelName_() + '\" */\n';
    frameStr += 'static const uint16_t ' + cName.toLowerCase() + '_pal[] = { \n';
    //var currentColors = pskl.app.currentColorsPalette.getColors();
    var palettes = pskl.app.currentColorsService.paletteService.getPalettes();
    var colors = palettes[1].getColors();
    var rgbpalette = []; 

    for (var i = 0 ; i < colors.length ; i++) {
      var r = this.hashtagRgbToHex(colors[i]).r;
      rgbpalette[ i * 3 ] = r;
      var g = this.hashtagRgbToHex(colors[i]).g;
      rgbpalette[ i * 3 + 1] = g;
      var b = this.hashtagRgbToHex(colors[i]).b;
      rgbpalette[ i * 3 + 2] = b;
      var hexStr = '0x';
      r >>= 3;  // eliminate 3 lowest bits
      r <<= 11; // shift up
      g >>= 2;  // eliminate 2 lowest bits
      g <<= 5;  // shift up
      b &= 0x1F;// eliminate 3 highest bits
      var val565 = r | g | b ;
      hexStr += val565.toString(16);
      frameStr += hexStr + ', ';
    }

    frameStr += '\n};\n\n'; //end of palette

    // Write indexed colors into file
    frameStr += '/* Piskel data for \"' + this.getPiskelName_() + '\" */\n';

    frameStr += 'static const uint8_t ' + cName.toLowerCase();
    frameStr += '_data[' + frameCount + '][' + width * height + '] = {\n';

    for (var i = 0 ; i < frameCount ; i++) {
      var render = this.piskelController.renderFrameAt(i, true);
      var context = render.getContext('2d');
      var imgd = context.getImageData(0, 0, width, height);
      var pix = imgd.data;

      frameStr += '{\n';
      for (var j = 0; j < pix.length; j += 4) {
        //frameStr += this.rgbToCHex(pix[j], pix[j + 1], pix[j + 2], pix[j + 3]);
        var found = 0;
        for (var k = 0 ; k < colors.length ; k++) {
          if (!found && pix[j] == rgbpalette[k*3] && pix[j+1] == rgbpalette[k*3+1] && pix[j+2] == rgbpalette[k*3+2]) {
            frameStr += '0x' + k.toString(16) + ',';
            found = 1;
          } 
        }
        if (!found) frameStr += '0xFF,'; //no match found, assuming transparent color
        
        //if (j != pix.length - 4) {
        //  frameStr += ', ';
        //}
        if (((j + 4) % (width * 4)) === 0) {
          frameStr += '\n';
        }
      }
      if (i != (frameCount - 1)) {
        frameStr += '},\n';
      } else {
        frameStr += '}\n';
      }
    }

    frameStr += '};\n';
    pskl.utils.BlobUtils.stringToBlob(frameStr, function(blob) {
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }.bind(this), 'application/text');
  };

  ns.MiscExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };

// hashtagRgbtoHex - https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
  ns.MiscExportController.prototype.hashtagRgbToHex = function (hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };


// rgbTo565 function - converts to 16 bit color value
  ns.MiscExportController.prototype.rgbTo565 = function (r,g,b) {
    return '0x' ;
  };

  ns.MiscExportController.prototype.rgbToCHex = function (r, g, b, a) {
    var hexStr = '0x';
    hexStr += ('00' + a.toString(16)).substr(-2);
    hexStr += ('00' + b.toString(16)).substr(-2);
    hexStr += ('00' + g.toString(16)).substr(-2);
    hexStr += ('00' + r.toString(16)).substr(-2);
    return hexStr;
  };

  ns.MiscExportController.prototype.onDownloadSelectedFrameClick_ = function (evt) {
    var frameIndex = this.piskelController.getCurrentFrameIndex();
    var fileName = this.getPiskelName_() + '-' + (frameIndex + 1) + '.png';
    var canvas = this.piskelController.renderFrameAt(frameIndex, true);

    pskl.utils.BlobUtils.canvasToBlob(canvas, function(blob) {
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    });
  };
})();
