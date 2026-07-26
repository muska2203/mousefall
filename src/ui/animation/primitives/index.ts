/**
 * Библиотека низкоуровневых примитивов для UI-анимаций.
 *
 * Примитивы не зависят от конкретного шага анимации и могут использоваться
 * в любом executor'е или renderer'е.
 */

export {runTweenedGraphics, type TweenedGraphicsOptions} from './tweenedGraphics';
export {runParticleBurst, type ParticleBurstOptions} from './particleBurst';
export {runArc, type ArcOptions} from './arc';
export {runBeam, type BeamOptions} from './beam';
export {FollowCamera, type FollowCameraOptions} from './followCamera';
