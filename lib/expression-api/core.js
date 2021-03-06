/**
 * Expression authors should use UT.Expression.ready(callback) to run
 * their expression initialization code.
 */
UT.Expression = (function(){
  var classModule, // returned module
      isReady = false, // set to true once the document is ready.
      postFunction = null,
      types = {},
      _states,
      expression = null,
      extensions = [],
      _callBacks = {};

  /**
   * Extend the Expression.
   *
   * @namespace the name of the submodule
   * @extension an object or a function that will match the namespace.
   * @throw if the namespace is already defined
   * @return nothing
   */
  function extendExpression(namespace, extension){
    expression = null ; // reset expression singleton.
    extensions.push({name: namespace, module: extension}) ;
  }

  /**
   * Register a function <tt>fn</tt> to be called once the expression is ready.
   */
  function ready(fn) {
    this._getInstance().bind('ready', fn);
    if(expression.isReady){
      fn.apply(this, [expression]);
    }

    // handle touchs
    if ('ontouchstart' in window || 'onmsgesturechange' in window) {
      document.querySelector('html').className = document.querySelector('html').className + ' touch';

      if (typeof FastClick != 'undefined') {
        window.addEventListener('load', function() {
          new FastClick(document.body);
        }, false);
      }
    }

    return expression;
  }

  classModule = {
    ready: ready,
    extendExpression: extendExpression,
    _expression: expression
  };

  // == Undocumented Functions.

  /**
   * @private
   * @param methodName {String} method of the APi to call
   * @param args {Array} arguments to the method
   * @param callBack {Function} the callback function that will contains the result of call
   */
  function _callAPI(methodName, args, callback) {
    var jsonMessage = {
      type:"ExpAPICall",
      methodName:methodName,
      args:args,
      expToken: _states ? _states.expToken : null
    };
    if(callback){
      // assign an id to the callback function
      var callbackId = UT.uuid().toString();
      _callBacks[callbackId] = callback;
      jsonMessage.callbackId = callbackId;
    }
    var json = JSON.stringify(jsonMessage);
    window.parent.postMessage(json, "*");
  }

  function _getInstance(){
    expression = expression || _buildExpression({});
    return expression;
  }

  function _reset(){
    expression = null;
  }

  classModule._callAPI = _callAPI;
  classModule._getInstance = _getInstance;
  classModule._reset = _reset;

  // == Private Functions.

  /**
   * build an instance of Expression
   */
  function _buildExpression(expression){
    var debug = (window.console && console.log),
        eventTypesBindings = {}; // handle event bindings for each event type

    /**
     * post message handler
     */
    window.addEventListener("message", function (e) {
      // webdoc will always set json data so we parse it
      try {
          msgObj = JSON.parse(e.data);
      }
      catch (exception) {
          if (console && console.error) {
              console.error("receive invalid message", e.data, exception.message) ;
          }
          msgObj = {};
      }
      _dispatch(msgObj);
    }, false);

    /**
     * Calls all fns in the list for a given type. Passes arguments
     * through to the caller.
     * @params {String} type The type to trigger
     */
    function trigger(type) {
      var list = eventTypesBindings[type],
          promises = [],
          nextTrigger = 'after' + type.charAt(0).toUpperCase() + type.slice(1),
          listLength,
          listIndex,
          callbackFunction,
          callbackArgs,
          promise;

      // Nothing to trigger
      if (!list) {
        return;
      }

      // We copy the list in case the original mutates while we're
      // looping over it. We take the arguments, lop of the first entry,
      // and pass the rest to the listeners when we call them.
      list = list.slice(0);
      listLength = list.length;
      listIndex = -1;
      callbackArgs = Array.prototype.slice.call(arguments, 1);

      while (++listIndex < listLength) {
        callbackFunction = list[listIndex];
        promise = callbackFunction.apply(classModule, callbackArgs);
        if(promise && typeof promise.then === 'function') {
          promises.push(promise);
        }
      }

      if(promises.length > 0) {
        when.all(promises).then(function() {
          trigger(nextTrigger);
        });
      }
      else {
        trigger(nextTrigger);
      }
    }

    /**
     * Adds a listener fn to the list for a given event type.
     */
    function bind(type, fn) {
      var list = eventTypesBindings[type] || (eventTypesBindings[type] = []);

      // This fn is not a function
      if (typeof fn !== 'function') {
        return;
      }

      list.push(fn);
    }

    /**
     * Removes a listener fn from its list.
     */
    function unbind(type, fn) {
      var list = eventTypesBindings[type],
      l;

      // Nothing to unbind
      if (!list) {
        return;
      }

      // No function specified, so unbind all by removing the list
      if (!fn) {
        delete eventTypesBindings[type];
        return;
      }

      // Remove all occurences of this function from the list
      l = list ? list.indexOf(fn) : -1;

      while (l !== -1) {
        list.splice(l, 1);
        l = list.indexOf(fn);
      }
    }

    /**
     * register a post callback.
     */
    //REVIEW: this method has a bad name: post should be use to trigger the post action from within the expression.
    //        the async parameter looks weird to my eyes as well.
    // TODO : use BIND
    function post(fn) {
      postFunction = fn;
    }


    function setNote(note){
      if (typeof(note) == 'string') {
        _states.note = note;
        // TODO : think : do we need a callback or not here
        UT.Expression._callAPI('document.setNote', [note], function(){});
      }
      else {
        // Warning for Expression developers
        console.error('note should be a string (expression.setNote)');
      }
    }

    /*
     *  Call to activate / de activate next button
     *  @param ready [boolean] : true : activate, false : deactivate
     */
    function readyToPost(ready) {
      if(ready !== undefined && ready != _states.readyToPost ){
        _states.readyToPost = !!ready;
        UT.Expression._callAPI('document.readyToPost', [_states.readyToPost], function(){});
      }
      return _states.readyToPost;
    }

    function getNote(){
      return _states.note;
    }
    /**
     * Bind the callback function to the modeChanged event.
     * The function will receive the new mode string (edit or view).
     */
    function modeChanged(fn) {
      bind('modeChanged', fn);
    }

    /**
     * Bind the callback function to the scrollChanged event.
     * The function will receive the new scroll values.
     */
    function scrollChanged(fn) {
      bind('scrollChanged', fn);
    }

    /**
     * Bind the callback function to the imageAdded event.
     * The function will receive the image and optional extraData param.
     * @param {Function} fn
     */
    function imageAdded(fn) {
      bind('imageAdded', fn);
    }

    /**
     * Retrieve the current display mode of the expression ('either view or edit')
     */
    function getMode() {
      return _states.mode;
    }

    /**
     * Retrieve the current scroll values
     */
    function getScrollValues() {
      return _states.scrollValues;
    }

    /**
     * Retrieve an expression 'state' by its key.
     */
    // REVIEW: this is not self-explanatory and exposes the internal API. We should have a private method here instead.
    function getState(key) {
      if(!(_states && _states[key])){ return; }
      return _states[key];
    }

    /**
     * Retrieve the container DOM node.
     */
    function getElement(){
      return document.querySelector('.webdoc_expression_wrapper');
    }

    function initializeExtension(){
      // load expression extensions
      for(var i in extensions) {
        var ext = extensions[i];
        if(expression[ext.name]){
          throw "Extension " + ext.name + " is already defined.";
        }
        if(typeof ext.module === 'function'){
          expression[ext.name] = ext.module.call(UT, expression);
        } else {
          expression[ext.name] = ext.module;
        }
      }
    }

    /**
     * Native text input for mobile.
     *
     * if options is passed, it might contains:
     * - value, the default value,
     * - max, the number of chars allowed,
     * - multiline, if true, allow for a multiline text input
     *
     * The callback will be passed the resulting string or null
     * if no value have been selected.
     *
     * DEPRECATED signature: (defaultValue, max, callback)
     */
    function textInput(options, callback) {
      if(typeof arguments[0] == 'string'){
        options = {
          value: arguments[0],
          max: arguments[1]
        };
        callback = arguments[2];
      } else if(typeof options == 'function'){
        callback = options;
        options = {};
      }
      UT.Expression._callAPI(
        'document.textInput',
        [options.value || null, options.max || null, options.multiline || false],
        callback
      );
    }


    function dialog(type, options, callback) {
      if (callback === undefined && typeof(options) === 'function') {
        callback = options;
        options = {};
      }
      switch (type) {
        case 'sound':
            UT.Expression._callAPI('medias.openSoundChooser', [options], callback);
        break;
        case 'image':
          if (options && options.size && options.size.auto) {
            if(window.console && console.warn){
              console.warn('Use of size.auto is deprecated, use size.autoCrop instead');
            }
          }
          UT.Expression._callAPI(
            'medias.openImageChooser',
            [options],
            function(imageDescriptor) {
             callback.call(this, imageDescriptor);
          });
        break;
        case 'video':
          UT.Expression._callAPI('medias.openVideoChooser', [options], callback);
        break;
      }
    }


    /** 
     * Get Parent Post Datas
     */
    function getParentData() {
      return this.getState('parentData') || {};
    }
    
    function pushNavigation(state, callback) {
      UT.Expression._callAPI('container.pushNavigation', [state], callback);
    }

    function popNavigation() {
      UT.Expression._callAPI('container.popNavigation');
    }

    function navigate(app) {
      var options = {};
      if (arguments.length >= 2) {
        options = arguments[1];
      }
      else if (arguments.length === 1) {
        options = app;
        app = 'browse';
      }
      var opt = {
        app : app,
        parameters : options
      };
      UT.Expression._callAPI('container.navigate', [opt]);
    }

    expression.navigate = navigate;

    expression.pushNavigation = pushNavigation;
    expression.popNavigation = popNavigation;

    expression.dialog = dialog;
    expression.textInput = textInput;

    // Events bindings
    expression.trigger = trigger;
    expression.bind = bind;
    expression.unbind = unbind;

    // Post event
    expression.post = post;
    // ?? executePost ? TODO ?

    expression.modeChanged = modeChanged;
    expression.scrollChanged = scrollChanged;
    expression.imageAdded = imageAdded;

    // Retrieve expression mode ('edit' or 'view')
    expression.getMode = getMode;

    // Retrieve scroll values
    expression.getScrollValues = getScrollValues;

    // retrieve a specific state
    expression.getState = getState;

    expression.getElement = getElement;

    expression.initializeExtension = initializeExtension;
    
    expression.getNote = getNote;
    expression.setNote = setNote;

    expression.readyToPost = readyToPost;

    expression.getParentData = getParentData;

    // == Private Methods

    function _dispatch(msg) {
      switch (msg.type) {
        case 'ready' :
          _ready(msg.options);
          break;
        case 'triggerEvent' :
          trigger.apply(this, [msg.eventName].concat(msg.eventArgs));
          break;
        case 'callback' :
          _receiveCallBack(msg.callbackId, msg.result);
          break;
        case 'post' :
          _post();
      }
    }

    function _ready(states) {
      expression.isReady = true;
      _states = states;

      // default ready to post state is false
      _states.readyToPost = false;
      bind('modeChanged', function(newMode) {
        _states.mode = newMode;
      });
      bind('scrollChanged', function(newScrollValues) {
        _states.scrollValues = newScrollValues;
      });
      bind('afterReady', function() {
        _changeCurrentState('initialized');
      });
      initializeExtension();
      trigger('ready', expression);
    }
    expression._ready = _ready;

    function _post() {
      if (postFunction) {
        postFunction.call(classModule, function() {});
      }
      UT.Expression._callAPI("posted");
    }

    function _changeCurrentState(newState) {
      UT.Expression._callAPI("changeCurrentState", [newState]);
    }
    /**
     * Events called when callback are recieved from post message.
     * @private
     * @param callBackUUID the uuid of the callback to call
     * @param result the result parameter to the caallback
     */
    function _receiveCallBack(callBackUUID, result) {
      var callBack = _callBacks[callBackUUID];
      if (callBack) {
        if ( !(result && result instanceof Array )) {
          if(window.console && console.error){
            console.error('received result is not an array.', result);
          }
        }
        callBack.apply(this, result);
        delete _callBacks[callBackUUID];
      }
    }
    return expression;
  }

  return classModule;
})();
