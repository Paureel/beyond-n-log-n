import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_VIEW,MAX_ZOOM,zoomViewport,panViewport} from '../lib/timeline-viewport.mjs';

test('zoom preserves the time and kappa beneath the pointer',()=>{
  const view={x:.2,y:.1,width:.5,height:.25},next=zoomViewport(view,2,.8,.3);
  assert.equal(next.width,.25);
  assert.equal(next.height,.125);
  assert.ok(Math.abs(view.x+.8*view.width-(next.x+.8*next.width))<1e-12);
  assert.ok(Math.abs(view.y+.3*view.height-(next.y+.3*next.height))<1e-12);
});

test('zoom stays inside the full domain and supports both edges',()=>{
  assert.deepEqual(zoomViewport(FULL_VIEW,2,0,1),{x:0,y:.5,width:.5,height:.5});
  const close=zoomViewport(FULL_VIEW,1e6,1,1);
  assert.equal(close.width,1/MAX_ZOOM);
  assert.equal(close.x+close.width,1);
  assert.equal(close.y+close.height,1);
  assert.deepEqual(zoomViewport(close,1e-6),FULL_VIEW);
});

test('panning is proportional to the visible range and clamps at its boundaries',()=>{
  assert.deepEqual(panViewport({x:.25,y:.25,width:.5,height:.25},.25,-.25),{x:.375,y:.1875,width:.5,height:.25});
  assert.deepEqual(panViewport({x:.25,y:.25,width:.5,height:.25},10,-10),{x:.5,y:0,width:.5,height:.25});
  assert.deepEqual(panViewport(FULL_VIEW,10,10),FULL_VIEW);
});

test('a fitted small kappa range keeps its precision when the time axis is zoomed',()=>{
  const view={x:.8,y:.9,width:.1,height:1e-9},next=zoomViewport(view,2);
  assert.equal(next.width,.05);
  assert.equal(next.height,view.height);
  assert.equal(next.y,view.y);
  assert.equal(zoomViewport(view,.5).height,2e-9);
});
