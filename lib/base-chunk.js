var ObservStruct = require('@mmckegg/mutant/struct')
var Observ = require('@mmckegg/mutant/value')
var Property = require('observ-default')
var ObservVarhash = require('observ-varhash')
var NodeArray = require('observ-node-array')
var ArrayGrid = require('array-grid')
var computed = require('@mmckegg/mutant/computed')
var nextTick = require('next-tick')
var deepEqual = require('deep-equal')
var extend = require('xtend/mutable')
var withResolved = require('lib/with-resolved')

module.exports = BaseChunk

function BaseChunk (context, extraProperties, opts) {

  var broadcastingActiveSlots = false

  var obs = ObservStruct(extend({
    id: Observ(),
    shape: Property([1,4]),
    flags: Property([]),
    chokeAll: Property(false),
    chokeGroup: Property(),
    color: Property([255,255,255]),
    minimised: Property(false)
  }, extraProperties))

  if (context.setup) {
    obs.selected = computed([obs.id, context.setup.selectedChunkId], function (id, selectedId) {
      return id === selectedId
    })
  }

  obs.context = context

  obs.activeSlots = Observ([])

  obs.triggerOn = function (id, at) {
    var slot = context.slotLookup.get(id)

    if (obs.chokeGroup()) {
      var chokeGroup = resolve(obs.chokeGroup)
      context.setup.chunks.forEach(function (chunk) {
        var node = chunk.node || chunk
        if (node && node !== obs && resolve(node.chokeGroup) === chokeGroup) {
          chokeAll(node, at)
        }
      })
    }

    if (obs.chokeAll()) {
      chokeAll(obs, at)
    }

    if (slot) {
      if (slot().chokeGroup) {
        obs.triggers().forEach(function (id) {
          var otherSlot = context.slotLookup.get(id)
          if (otherSlot && otherSlot !== slot && otherSlot().chokeGroup === slot().chokeGroup) {
            otherSlot.choke && otherSlot.choke(at)
          }
        })
      }
      slot.triggerOn(at)
    }

    if (!obs.activeSlots().includes(id)) {
      obs.activeSlots().push(id)
      broadcastActiveSlots()
    }
  }

  obs.triggerOff = function (id, at) {
    var slot = context.slotLookup.get(id)
    if (slot) {
      slot.triggerOff(at)
    }

    if (obs.activeSlots().includes(id)) {
      obs.activeSlots().splice(obs.activeSlots().indexOf(id), 1)
      broadcastActiveSlots()
    }
  }

  obs.choke = function (id, at) {
    var slot = context.slotLookup.get(id)
    if (slot && slot.choke){
      slot.choke(at)
    }
  }

  obs.getSlot = function(id){
    return context.slotLookup.get(id)
  }

  obs.triggers = computed([obs.id, obs.shape, context.slotLookup], function(id, shape){
    var length = shape[0] * shape[1]
    var result = []
    for (var i=0;i<length;i++){
      if (obs.getSlot(String(i)) || (opts && opts.includedAllTriggers)) {
        result.push(String(i))
      } else {
        result.push(null)
      }
    }
    return result
  })

  obs.grid = computed([obs.triggers, obs.shape], ArrayGrid)

  obs.resolvedGrid = computed([obs.triggers, obs.shape], function(triggers, shape){
    return ArrayGrid(triggers.map(getGlobalId), shape)
  })

  obs.resolved = withResolved(obs, ['triggers'])

  return obs

  // scoped

  function broadcastActiveSlots () {
    if (!broadcastingActiveSlots) {
      broadcastingActiveSlots = true
      setImmediate(broadcastActiveSlotsNow)
    }
  }

  function broadcastActiveSlotsNow () {
    broadcastingActiveSlots = false
    obs.activeSlots.set(obs.activeSlots())
  }

  function getGlobalId(id){
    if (id){
      return obs.id() + '/' + id
    }
  }
}

function resolve (val) {
  return typeof val === 'function' ? val() : val
}

function chokeAll(node, at) {
  if (node && node.shape && node.choke) {
    var shape = node.shape()
    var length = shape[0] * shape[1]
    for (var i = 0; i < length; i++) {
      node.choke(String(i), at)
    }
  }
}
