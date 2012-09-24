var CirclesAndArrows = (function(){
  function CirclesAndArrows(window, jQuery)  {
    this.window = window;
    this.$ = jQuery;

    this.parser = new Parser();
    this.renderer = new Renderer();

    this.states = [];
    this.transitions = [];
  }

  CirclesAndArrows.prototype.setupCanvas = function(container) {
    this.canvasContainer = container;
    this.canvas = this.$('<canvas />');
    this.canvas[0].height = container.height();
    this.canvas[0].width = container.width();
    this.canvasContainer.append(this.canvas);
    this.renderer.init(this.canvas[0]);
  }
  CirclesAndArrows.prototype.bindInput = function(input) {
    this.input = input;

    var ca = this;
    input.on('keypress', function() {
      clearTimeout(ca.timer);
      ca.timer = setTimeout(function() { ca.update() }, 300);
    });
    ca.update();
  }
  CirclesAndArrows.prototype.begin = function() {
    this.started = true;
  }
  CirclesAndArrows.prototype.stop = function() {
    clearInterval(this.timer);
  }
  CirclesAndArrows.prototype.update = function() {
    if (this.input.val() != this.rawData) {
      this.rawData = this.input.val();
      this.data = this.parse();
      this.drawOutput();
    }
  }
  CirclesAndArrows.prototype.parse = function() {
    this.parser.parse(this.rawData);
    this.updateTransitions(this.parser.transitions);
    this.updateStates(this.parser.states);
  }
  CirclesAndArrows.prototype.updateStates = function(states) {
    this.states = states;
    this.renderer.updateStates(states);
  }
  CirclesAndArrows.prototype.updateTransitions = function(transitions) {
    this.transitions = transitions;
    this.renderer.updateTransitions(transitions);
  }
  CirclesAndArrows.prototype.drawOutput = function() {
    this.renderer.render();
  }

  function Parser() {
    this.states = [];
    this.transitions = [];
  }
  Parser.prototype.TRANSITION_REGEX = /^(.+?)->(.+?)(?:\:(.*?)(?:\/(.*))?)?$/;
  Parser.prototype.parse = function(data) {
    var transitions = [];
    var states = {};
    var lines = data.split("\n");
    lines.forEach(function(line) {
      var match = this.TRANSITION_REGEX.exec(line);
      if (match) {
        var a = match[1].trim();
        var b = match[2].trim();
        states[b] = states[a] = true;
        var t = {a: a, b: b};
        if (match[3]) t.name = match[3].trim();
        if (match[4]) t.action = match[4].trim();
        transitions.push(t);
      }
    }.bind(this))
    this.states = Object.keys(states);
    this.transitions = transitions;
  }

  function Renderer(){
    this.CIRCLE_PADDING = 25;
    this.CIRCLE_MARGIN = 10;
    this.CIRCLE_SPACING = 100;

    this.circles = {};
    this.arrows = new Container();
  }
  Renderer.prototype.init = function(canvas) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.stage = new Stage(canvas);
    this.stage.addChild(this.arrows);
  }
  Renderer.prototype.render = function(states, transitions) {
    this.stage.clear();
    this.arrangeCircles();
    this.connectArrows();
    this.stage.update();
  }
  Renderer.prototype.updateStates = function(states) {
    var circles = this.circles;
    var new_circles = {};
    states.forEach(function(state) {
      if (state in circles) {
        new_circles[state] = circles[state];
        delete circles[state];
      } else {
        new_circles[state] = this.createCircle(state);
      }
    }.bind(this))
    Object.keys(circles).forEach(function(state) {
      this.destroyCircle(circles[state]);
    }.bind(this))
    this.circles = new_circles;
  }
  Renderer.prototype.createCircle = function(name) {
    var circle = new Container();

    var state = new Shape(this.getCircleGraphics());
    state.x = state.y = 0;
    circle.addChild(state);

    var text = this.createLabel(name);
    text.x = text.y = 0;
    circle.addChild(text);
    circle.minSize = text.getMeasuredWidth();

    this.stage.addChild(circle);
    return circle;
  }
  Renderer.prototype.destroyCircle = function(circle) {
    this.stage.removeChild(circle);
  }
  Renderer.prototype.getCircleGraphics = function() {
    if (!this._circle_graphics) {
      this._circle_graphics = new Graphics();
    }
    return this._circle_graphics;
  }
  Renderer.prototype.createLabel = function(string) {
    var text = new Text(string, '15px sans-serif', '#000');
    text.textBaseline = 'middle';
    text.textAlign = 'center';
    return text;
  }
  Renderer.prototype.updateTransitions = function(transitions) {
    this.arrows.removeAllChildren();
    transitions.forEach(function(t) {
      this.arrows.addChild(this.createArrow(t));
    }.bind(this))
  }
  Renderer.prototype.createArrow = function(transition) {
    var g = new Graphics();
    g.setStrokeStyle(5);
    g.beginStroke(Graphics.getRGB(0,0,0));
    var arrow = new Shape(g);
    arrow.transition = transition;
    this.stage.addChildAt(arrow, 0);
    return arrow;
  }
  Renderer.prototype.destroyArrow = function(arrow) {
    this.stage.removeChild(arrow);
  }
  Renderer.prototype.mapCircles = function(iterator) {
    return this._map(this.circles, iterator);
  }
  Renderer.prototype.eachArrow = function(iterator) {
    for (var i=0, l=this.arrows.getNumChildren(); i<l; ++i) {
      iterator(this.arrows.getChildAt(i));
    }
  }
  Renderer.prototype._map = function(object, iterator) {
    return Object.keys(object).map(function(key) {
      return iterator(object[key], key);
    })
  }
  Renderer.prototype.arrangeCircles = function() {
    // Figure out radius
    var circles = {};
    var radii = this.mapCircles(function(c) { return c.minSize });
    var radius = Math.max.apply(null, radii) / 2 + this.CIRCLE_PADDING
    var g = this.getCircleGraphics()
    g.clear();
    g.setStrokeStyle(3);
    g.beginStroke(Graphics.getRGB(0,0,0));
    g.beginFill(Graphics.getRGB(255,255,255));
    g.drawCircle(0, 0, radius);

    // Figure out locations
    var space = this.CIRCLE_SPACING, margin = this.CIRCLE_MARGIN;
    var x = margin + radius, y = margin + radius;
    var width = this.width, initial = x;
    this.mapCircles(function(circle) {
      circle.x = x, circle.y = y;

      x += 2 * radius + space;
      if ((x + radius + margin) >= width) {
        x = initial;
        y += 2 * radius + space;
      }
    })
  }
  Renderer.prototype.connectArrows = function() {
    var circles = this.circles;
    this.eachArrow(function(arrow) {
      var t = arrow.transition;
      var c1 = circles[t.a], c2 = circles[t.b];
      var g = arrow.graphics;
      arrow.x = c1.x, arrow.y = c1.y;
      g.moveTo(0, 0);
      g.lineTo(c2.x - c1.x, c2.y - c1.y);
    })
  }

  return CirclesAndArrows;
})()
