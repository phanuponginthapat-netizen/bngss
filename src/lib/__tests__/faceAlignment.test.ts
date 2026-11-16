import { describe, expect, it } from 'vitest';
import { faceSimilarityTransform, type AlignmentPoint } from '../faceAlignment';

const template: AlignmentPoint[] = [[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]];
describe('ArcFace alignment', () => {
  it.each([0, .3, -.5, 1])('maps rotated, scaled, translated landmarks back to the exact template (%s)', angle => {
    const src = template.map(([x,y]) => [3 * (Math.cos(angle)*x-Math.sin(angle)*y)+400, 3*(Math.sin(angle)*x+Math.cos(angle)*y)+200] as AlignmentPoint);
    const [a,b,c,d,e,f] = faceSimilarityTransform(src,template);
    src.forEach(([x,y],i) => {
      expect(a*x+c*y+e).toBeCloseTo(template[i][0],8);
      expect(b*x+d*y+f).toBeCloseTo(template[i][1],8);
    });
    expect(a*d-b*c).toBeGreaterThan(0);
  });
  it('rejects invalid and collapsed points instead of creating meaningless embeddings', () => {
    expect(()=>faceSimilarityTransform([[1,1],[1,1]],[[2,2],[3,3]])).toThrow();
    expect(()=>faceSimilarityTransform([[NaN,1],[2,2]],[[2,2],[3,3]])).toThrow();
  });
});