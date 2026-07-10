import angryFrown from './assets/feedback-faces/angry-frown.svg?raw'
import anxiousDroop from './assets/feedback-faces/anxious-droop.svg?raw'
import bashfulSmile from './assets/feedback-faces/bashful-smile.svg?raw'
import broadToothyGrin from './assets/feedback-faces/broad-toothy-grin.svg?raw'
import calmFreckledSmile from './assets/feedback-faces/calm-freckled-smile.svg?raw'
import cheekyTongue from './assets/feedback-faces/cheeky-tongue.svg?raw'
import contentSmile from './assets/feedback-faces/content-smile.svg?raw'
import eyelashPucker from './assets/feedback-faces/eyelash-pucker.svg?raw'
import freckledCheekyGrin from './assets/feedback-faces/freckled-cheeky-grin.svg?raw'
import freckledToothyGrin from './assets/feedback-faces/freckled-toothy-grin.svg?raw'
import goofyLongTongue from './assets/feedback-faces/goofy-long-tongue.svg?raw'
import joyfulHeartGrin from './assets/feedback-faces/joyful-heart-grin.svg?raw'
import laughingOpenMouth from './assets/feedback-faces/laughing-open-mouth.svg?raw'
import nervousTeeth from './assets/feedback-faces/nervous-teeth.svg?raw'
import puckeredKiss from './assets/feedback-faces/puckered-kiss.svg?raw'
import puzzledPucker from './assets/feedback-faces/puzzled-pucker.svg?raw'
import sadDroopyFace from './assets/feedback-faces/sad-droopy-face.svg?raw'
import sideEyeSmirk from './assets/feedback-faces/side-eye-smirk.svg?raw'
import wideEyedSmile from './assets/feedback-faces/wide-eyed-smile.svg?raw'
import wildToothyGrin from './assets/feedback-faces/wild-toothy-grin.svg?raw'

export const feedbackFaceNames = [
  'angry-frown',
  'anxious-droop',
  'bashful-smile',
  'broad-toothy-grin',
  'calm-freckled-smile',
  'cheeky-tongue',
  'content-smile',
  'eyelash-pucker',
  'freckled-cheeky-grin',
  'freckled-toothy-grin',
  'goofy-long-tongue',
  'joyful-heart-grin',
  'laughing-open-mouth',
  'nervous-teeth',
  'puckered-kiss',
  'puzzled-pucker',
  'sad-droopy-face',
  'side-eye-smirk',
  'wide-eyed-smile',
  'wild-toothy-grin',
] as const

export type FeedbackFaceName = typeof feedbackFaceNames[number]
export type FeedbackStateKind = 'empty' | 'search' | 'error' | 'unavailable' | 'success'

export const feedbackFaces: Record<FeedbackFaceName, string> = {
  'angry-frown': angryFrown,
  'anxious-droop': anxiousDroop,
  'bashful-smile': bashfulSmile,
  'broad-toothy-grin': broadToothyGrin,
  'calm-freckled-smile': calmFreckledSmile,
  'cheeky-tongue': cheekyTongue,
  'content-smile': contentSmile,
  'eyelash-pucker': eyelashPucker,
  'freckled-cheeky-grin': freckledCheekyGrin,
  'freckled-toothy-grin': freckledToothyGrin,
  'goofy-long-tongue': goofyLongTongue,
  'joyful-heart-grin': joyfulHeartGrin,
  'laughing-open-mouth': laughingOpenMouth,
  'nervous-teeth': nervousTeeth,
  'puckered-kiss': puckeredKiss,
  'puzzled-pucker': puzzledPucker,
  'sad-droopy-face': sadDroopyFace,
  'side-eye-smirk': sideEyeSmirk,
  'wide-eyed-smile': wideEyedSmile,
  'wild-toothy-grin': wildToothyGrin,
}
