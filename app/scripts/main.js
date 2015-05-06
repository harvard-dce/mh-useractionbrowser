
/*global d3:false */
/*global useractionBrowser */
/*jshint unused:false */

function _createViewingBrowser(conf,uab) {
  'use strict';

  if ( ! uab ) {
    uab = {};
  }

  var width  = conf.width;
  var height = conf.height;
  var maxViewingHeight = 0;
  var minViewingHeight = 4;
  
  var resized = true;

  uab.dateStarted = null;
  uab.dateCompleted = null;

  uab.dataSources = conf.dataSources;

  var textFilter = '';

  uab.viewingstates = [];

  var target = conf.target;
  var dateFormat = d3.time.format('%Y-%m-%dT%X');
  var viewings;
  var rows =[[]];

  var rulerHeight = 20;

  var viewingHeight = 0;
  
  var offHours   = [];
  var midnights  = [];

  var twentyFourHoursInMs = 24*60*60*1000;

  var updateTimeSpan = function updateTimeSpan(parentSpan,object) {
    if (object.hasOwnProperty('dateStarted')) {
      if (parentSpan.dateStarted === null ||
          object.dateStarted < parentSpan.dateStarted ) {
        parentSpan.dateStarted = object.dateStarted;
      }
    }
    if (object.hasOwnProperty('dateCompleted')){
      if (parentSpan.dateCompleted === null ||
          object.dateCompleted > parentSpan.dateCompleted ) {
        parentSpan.dateCompleted = object.dateCompleted;
      }
    }
  };


  var parseViewingDates = function parseViewingDates(object) {
    object.dateStarted   = new Date(object.dateStarted);
    object.dateCompleted = new Date(object.dateCompleted);
    console.log("reinos" + object.dateStarted);
    console.log("reinos" + object.dateCompleted);
    // use one timestamp for both ends if that's all we have.
    if (! (object.hasOwnProperty('dateStarted') &&
           object.hasOwnProperty('dateCompleted'))  ) {
      if (object.hasOwnProperty('dateCompleted') ){
        object.dateStarted = object.dateCompleted;
      }
      if (object.hasOwnProperty('dateStarted')) {
        object.dateCompleted = object.dateStarted;
      }
    }
    updateTimeSpan(uab,object);
  };

  
  var getRow = function getRow(event){
    var eventFits = true;
    var eventRow  = -1;
    if ( ! (event.dateStarted && event.dateCompleted )) {
      // can't stack these guys.
      return -1;
    }
    $.each(rows,function(rowI,rowEvents){
      if (eventRow > -1){
        return false;
      }
      eventFits = true;
      $.each(rowEvents,function(eventI,e){
        if ( e.dateStarted <= event.dateCompleted &&
             e.dateCompleted >=  event.dateStarted ) {
          eventFits = false;
          return false;
        }
      });
      if ( eventFits ) {
        rowEvents.push(event);
        eventRow = rowI;
        return false;
      }
    });
    if (eventFits ) {
      return eventRow;
    } else {
      rows.push([]);
      rows[rows.length-1].push(event);
      return rows.length-1;
    }
  };

  var makeMidnight = function makeMidnight(day){
    day.setHours(0);
    day.setMinutes(0);
    day.setSeconds(0);
    return day;
  };

  var calculateOffHours = function calculateOffHours(){
    var oh ={};
    oh.dateCompleted = uab.dateCompleted;
    var d = new Date(uab.dateStarted.getTime());
    while (oh.dateCompleted <= uab.dateCompleted) {
      oh = {};
      oh.dateStarted   = new Date(d.getTime());
      oh.dateStarted.setHours(17);   // 5 pm
      oh.dateCompleted = new Date(d.getTime());
      oh.dateCompleted.setHours(24); // 24 makes it next day
      oh.dateCompleted.setHours(9);  // 9 am
      d = oh.dateCompleted;
      offHours.push(oh);
      midnights.push(makeMidnight(new Date(oh.dateStarted.getTime())));
    }
    midnights.push(makeMidnight(new Date(oh.dateCompleted.getTime())));
  };

  var matchAny = function matchAny(pattern,strings){
    var i;
    for(i = 0; i < strings.length; i++) {
      if (pattern.test(strings[i])){
        return true;
      }
    }
    return false;
    };

    var showViewing = function showViewing(viewing){
        // should we show this viewing?
      console.log(viewing);
      if (viewing.hasOwnProperty('dateStarted') &&
          viewing.hasOwnProperty('dateCompleted')){
        return true;
      }
      return false;
    };

  var durationPredicate = function durationPredicate(viewing){
    if ( uab.durationFilter ) {
      var f = uab.durationFilter;
      if ( f.op === '*' ) {
        console.log('*');
        return true;
      } else {
        var expression = viewing[f.field]+ f.op + (f.val*60*1000);
        var wfd = viewing[f.field];
        var d   =  (f.val*60*1000);
        if (f.op === '<=') {
          return wfd <=  d;
        } else if (f.op === '>') {
          return wfd >  d;
        } else {
          console.log('Unsupported op: ' + f.op);
        }
      }
      return false;
    }
    return true;
  };

  var stackViewings = function stackViewings(viewings){
    viewings = _.sortBy(viewings, 'dateStarted');
    $.each(viewings,function(i,viewing){
      var row = getRow(viewing);
      viewing.row = row;
    });
  };

  var processViewing = function processViewing(viewing){
    parseViewingDates(viewing);
    if (uab.viewingstates.indexOf(viewing.state)===-1){
      uab.viewingstates.push(viewing.state);
    }
    if ( viewing.dateCompleted === null || viewing.dateStarted === null ) {
      delete viewing.dateCompleted;
      delete viewing.dataStarted;
    }
    if (showViewing(viewing)) {
      console.log(viewing);
      viewing.duration =
        viewing.dateCompleted.getTime() - viewing.dateStarted.getTime();
      viewings.push(viewing);
    }
  };

  var setViewings = function setViewings(wfs){
    // blow out any existing viewings and set to given.
    rows = [[]];
    viewings = [];
    $.each(wfs,function(i,viewing){
      processViewing(viewing);
    });
    viewings=_.filter(viewings,durationPredicate);
    stackViewings(viewings);
    var visibleViewingIds = _.pluck(viewings,'id');
    //todo: faster contains
    console.log('viewings visible: ' + viewings.length);
  };

  var addUpdateViewings = function addUpdateViewings(wfs){
    var addUpdateIds = _.map(wfs,function(wf){return wf.id;});
    conf.viewings = _.reject(conf.viewings,
                              function(wf){
                                return _.contains(addUpdateIds,wf.id);
                              });
    conf.viewings = conf.viewings.concat(wfs);
    rawReload();
  };

  var removeViewings = function removeViewings(date,before){
    conf.viewings = _.reject(conf.viewings,
                              function(wf){
                                if ( before ) {
                                  return wf.dateCompleted < date;
                                } else {
                                  return wf.dateStarted > date;
                                }
                              });
    rawReload();
  };

  setViewings(conf.viewings);
  calculateOffHours();

  console.log('dateStarted: ' + uab.dateStarted);
  console.log('dateCompleted: ' + uab.dateCompleted);

  var container = d3.select(target);
  container.selectAll('*').remove();
  var nav = container.append('div').style('vertical-align','top');
  nav.classed('row',true);

  var skinnyCol = 'col-xs-6 col-sm-4 col-md-2';
  var fatCol    = 'col-xs-6 col-sm-3 col-md-2';

  var createSelectionLoader =
      function createSelectionLoader(label,id,options,selected){
        var d = nav.append('div').html(
          '<select class="form-control" id="' + id + '"></select>');
    d.classed(skinnyCol,true);
    $.each(options, function(key, value) {
      $('#'+id)
        .append($('<option>', { value : value.name })
                .text(value.name));
    });
    $('#'+id).val(selected);
    $('#'+id).change(function(){
      conf.selectedDataSourceName = $('#'+id).val();
      //total reload.
      conf.height=height;
      conf.width =width;
      useractionBrowser(conf,uab);
    });
  };

  var createSelectionFilter =
      function createSelectionFilter(label,id,options,filterType){
        var d = nav.append(
          'div').html('<select multiple  id="' + id + '"></select>');
    d.classed(fatCol,true);
    $.each(options, function(key, value) {
      $('#'+id)
        .append($('<option>', { value : value })
                .text(value));
    });
    $('#'+id).multiselect({
      includeSelectAllOption: true,
      allSelectedText: 'All ' + label,
      nSelectedText: label,
      nonSelectedText: 'All ' + label,
      onChange: function(option, checked, select) {
        if ( $('#'+id).val() ) {
          uab[filterType]=$('#'+id).val();
        } else {
          uab[filterType]=[];
        }
        uab.reload();
      }
    });
  };

  var createTextFilter = function createTextFilter(){
    var id='textFilter';
    var d = nav.append('div').html(
      '<input class="form-control" type="text" placeholder="text filter (course,lecturer,student,location)" id="' + id + '">');
    d.classed(fatCol,true);
    $('#'+id).keyup(function(){
      textFilter=$('#'+id).val();
      uab.reload();
    });
  };

  var createDurationFilter = function createDurationFilter(){
    var id='durationFilter';
    var d = nav.append('div').html(
      '<select class="form-control" id="' + id + '"></select>');
    d.classed(fatCol,true);
    var durationFilters = [
      {'name': 'All Durations','op':'*' },
      {'name': 'Entire Viewing <= 5 minutes','field': 'duration','op':'<=', 'val':5},
      {'name': 'Entire Viewing >  5 minutes','field': 'duration','op':'>', 'val':5},
      {'name': 'Entire Viewing > 30 minutes','field': 'duration','op':'>', 'val':30},
      {'name': 'Entire Viewing > 60 minutes','field': 'duration','op':'>', 'val':60},
      {'name': 'Entire Viewing > 90 minutes','field': 'duration','op':'>', 'val':90},
      {'name': 'Entire Viewing >120 minutes','field': 'duration','op':'>', 'val':120},
      {'name': 'Entire Viewing >180 minutes','field': 'duration','op':'>', 'val':180},
    ];
    $.each(durationFilters, function(i, filter) {
      $('#'+id)
        .append($('<option>', { value : i })
                .text(filter.name));
    });
    $('#'+id).val(0);
    $('#'+id).change(function(){
      uab.durationFilter=durationFilters[$('#'+id).val()];
      uab.reload();
    });
  };

  createSelectionLoader('Host','hostselector',uab.dataSources,uab.dataSource.name);
  createTextFilter();
  createDurationFilter();

  var svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height);

  var scale = d3.time.scale()
      .domain([uab.dateStarted, uab.dateCompleted]).range([10,width]);

  var xaxis = d3.svg.axis().scale(scale)
      .orient('bottom');

  var updateXAxis = function(){
    // I don't quite get what this does,
    // but seems to be necessary after zoom and resize.
    svg.select('g').call(xaxis).selectAll('text').style('font-size', '8x');
  };

  var zoom = d3.behavior.zoom()
      .on('zoom', function(){
        uab.refresh();
      }).x(scale);

  // pane to catch zoom events.
  var zoomPane = svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('opacity', 0)
      .call(zoom);

  // x-axis
  svg.append('g')
    .attr('class', 'xaxis')
    .call(xaxis)
  ;

  uab.size = function(w,h) {
    if (!arguments.length) {
      return [width,height];
    }
    resized= true;
    width  = w;
    height = h;
    container.attr('width', width).attr('height', height);
    svg.attr('width', width).attr('height', height);
    scale.range([10, width]);
    xaxis.scale(scale);
    zoomPane.attr('width', width);
    zoomPane.attr('height', height);
    uab.refresh();
    resized= false;
    return uab;
  };

  var stateColor = function stateColor(state,defaultColor) {
    return _.result(uab.stateColors,state,defaultColor);
  };


  var toHHMMSS = function toHHMMSS(secNum) {
    var hours   = Math.floor(secNum / 3600);
    var minutes = Math.floor((secNum - (hours * 3600)) / 60);
    var seconds = Math.floor(secNum - (hours * 3600) - (minutes * 60));
    if (hours   < 10) {hours   = '0'+hours;}
    if (minutes < 10) {minutes = '0'+minutes;}
    if (seconds < 10) {seconds = '0'+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
  };

  // todo: rationalize tooltips.

  var toolTipSpace=175;

  var tipline = function tipline(key,value,color){
    var line = '<div><strong>' + key + ': </strong> <span';
    if (color) {
      line += ' style="color: ' + color + '" ';
    }
    line += '>' + (value ? value : '') + '</span></div>';
    return line;
  };

  var vTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset(function(d){
        return d3.mouse(this)[1]<toolTipSpace ? [10,-10] : [-10, 0];})
      .html(function(d) {
        return tipline('Viewing ID', d.id) +
          tipline('Lecturer','pending') +
          tipline('Course', 'pending') +
          tipline('Student Location', 'pending') +
          tipline('Viewing Start', d.dateStarted) +
          tipline('Viewing Completed', d.dateCompleted) +
          tipline('Viewing Duration',  toHHMMSS(d.duration/1000)) 
        ;
      });
  svg.call(vTip);

  vTip.direction(function(d) {
    vTip.attr('class', 'd3-tip');
    if (d3.mouse(this)[1] < toolTipSpace) {
      return 's';
    }
    return 'n';
  });

  var viewingUrl = function viewingUrl(viewingId) {
    return uab.dataSource.host + '/admin/index.html#/inspect?id=' + viewingId;
  };

  var setViewingHeight = function setViewingHeight(){
    maxViewingHeight = 28;
    viewingHeight = (height - rulerHeight) / rows.length;
    if (viewingHeight < minViewingHeight ) {
      viewingHeight = minViewingHeight;
    } else if (viewingHeight > maxViewingHeight ) {
      viewingHeight = maxViewingHeight;
    }
  };

  
  var sizeEvents = function sizeEvents(events){
    // [re]size viewings
    return events
      .attr('x', function(o){return scale(o.dateStarted);})
      .attr('width', function(o){return d3.max([2, scale(
        o.dateCompleted) - scale(o.dateStarted)]);});
  };

  var renderEvents = function renderEvents(){
    setViewingHeight();
    renderOffHours(offHours);
    renderMidnights(midnights);
    renderViewings(viewings);
  };

  var viewingY = function viewingY(v){
    return rulerHeight+ (v.row * (viewingHeight+2));
  };

  var renderViewings = function renderViewings(viewings){
    // enter
    var events = svg.selectAll('rect.viewing').data(viewings,function(d){return d.id;});
    events.enter()
      .append('rect')
      .attr('class', 'viewing')
      .attr('height', viewingHeight)
      .on('mouseover', vTip.show)
      .on('mouseout', vTip.hide)
      .style('fill',  function(d) {return 'orange';} )
      .style('stroke', 'white')
      .style('opacity',0.6)
      .attr("rx", 6)
      .attr("ry", 6)
    ;
    // update y
    if (resized){
      events
        .attr('y', function(d){ return viewingY(d); })
      ;
    }
    // update x
    events
      .call(sizeEvents)
    ;
    // remove
    events.exit().remove();
  };

  var renderMidnights = function renderMidnights(midnights){
    // enter
    var events = svg.selectAll('line.daybounds').data(midnights);
    events.enter()
      .append('line')
      .attr('class', 'daybounds')
      .style('stroke', 'gray')
      .style('stroke-dasharray', '1,0,1')
      .style('opacity',0.6)
      .style('pointer-events', 'none')
    ;
    // update y
    if (resized){
      events
        .attr('y1', rulerHeight )
        .attr('y2', height )
      ;
    }
    // update x
    events
      .attr('x1', function(d) {return scale(d); })
      .attr('x2', function(d) {return scale(d); })
    ;
    // remove
    events.exit().remove();
  };

  var renderOffHours = function renderOffHours(offHours){
    // enter
    var events = svg.selectAll('rect.offHours').data(offHours);
    events.enter()
      .append('rect')
      .attr('class', 'offHours')

      .style('fill',  '#f6f6f6')
      .style('stroke', '#f6f6f6')
      .style('opacity',0.6)
      .style('pointer-events', 'none')
    ;
    // update y
    if (resized){
      events
        .attr('y', rulerHeight )
        .attr('height', height-rulerHeight)
      ;
    }
    // update x
    events
      .call(sizeEvents)
    ;
    // remove
    events.exit().remove();
  };

  renderEvents();
  resized=false;

  uab.refresh = function(){
    updateXAxis();
    renderEvents();
  };

  var rawReload = function rawReload(){
    console.log('reloading viewing browser data...');
    setViewings(conf.viewings);
    uab.size(width,height);
  };

    // potentially slow, so we throttle it.
    uab.reload = _.throttle(rawReload,1000);

  uab.addUpdateViewings = addUpdateViewings;
  uab.removeViewings = removeViewings;
  uab.viewings = viewings;
  return uab;
}


function useractionBrowser(conf,uab){
  'use strict';
  if ( ! uab ) {
    uab = {};
  }
  uab.dataSource = _.find(conf.dataSources,function(ds){
    return ds.name === conf.selectedDataSourceName; });

  var dataUrl =  uab.dataSource.dataUrl;
  d3.select(conf.target).html(
    '<p class="uab_loading">Loading viewing data...</p>');
  d3.json(dataUrl, function(error,data) {
    if (error) {
      var message ='Error getting data from : ' + dataUrl;
      console.log(message);
      data = [];
    } else {
      console.log('got data from: ' + dataUrl);
    }
    conf.viewings = data;
    _createViewingBrowser(conf,uab);
  });
  return uab;
}
