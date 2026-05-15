// content/toolbar/crop.js
(function () {
    window.GeminiImageCropper = {
        crop: function (base64, area) {
            return window.GeminiNexusCrop.cropImage(base64, area);
        },
    };
})();
