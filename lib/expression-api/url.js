/**
 * Webdoc Url API
 */

UT.Expression.extendExpression('url', function(expression){
  var url = {};

  url['for'] = function(asset) {
    return url.getAssetPath(asset);
  };

  url.getAssetThroughProxy = function(asset)
  {
    return this.proxify(this.getAssetPath(asset));
  };

  url.getAssetPath = function(asset) {
    // var host = 'http://' + expression.getState('host');
    if (asset.indexOf('./') === 0) {
      asset = asset.substring(1);
    }
    if (expression.getState('assetPath').indexOf('http') === -1) {
      return  'http://' + expression.getState('host') + '/' + expression.getState('assetPath') + asset;
    }
    return expression.getState('assetPath') + asset;
  };

  url.proxify = function(urlOrBase64){
  //  console.log('Proxify : ', urlOrBase64);
    var host = window.location.protocol + '//' + expression.getState('host') + '/image_proxy/';
    if (typeof(urlOrBase64) == 'string' &&
        urlOrBase64.indexOf('data:image') !== 0 &&
        urlOrBase64.indexOf('image_proxy') == -1){
      var newUrl = urlOrBase64;
      if (urlOrBase64.indexOf('http://') === 0)
        newUrl = host + urlOrBase64.substring(7);
      else if(urlOrBase64.indexOf('https://') === 0)
        newUrl = host + urlOrBase64.substring(8);
      else if(urlOrBase64.indexOf('./') === 0 || urlOrBase64.indexOf('/') === 0)
        return urlOrBase64;
      else if(urlOrBase64.indexOf('//') === 0)
        newUrl = host + urlOrBase64.substring(2);
      else
        newUrl = host + urlOrBase64;
      return newUrl;
    }
    return urlOrBase64;
  };
  return url;
});

