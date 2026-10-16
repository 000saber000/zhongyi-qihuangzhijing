import test from 'node:test';
import assert from 'node:assert/strict';
import * as camera from '../camera';

test('idle rotation advances the same angle at one, four and sixty frames per second',()=>{
 const advance=(camera as any).advanceIdleRotation;
 assert.equal(typeof advance,'function','idle yaw needs a time-based integration step');
 const run=(fps:number)=>{let speed=0,angle=0;for(let i=0;i<10*fps;i++){const step=advance(speed,1/fps);speed=step.speed;angle+=step.angle;}return angle;};
 const sixty=run(60);assert(Math.abs(sixty-1.045)<.000001);
 for(const fps of [1,4])assert(Math.abs(run(fps)-sixty)<.000001,`${fps} fps must not slow the model's rotation`);
 const stall=advance(.11,30);assert(stall.angle<=.11,'a stalled or restored frame must not jump by multiple seconds');
});
