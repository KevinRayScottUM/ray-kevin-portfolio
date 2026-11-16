import {PhotonImage} from '@cf-wasm/photon/workerd';
import {validatorHandler} from './decode.js';

// No public route, credentials, storage, logging or outbound requests.
export default {fetch:validatorHandler(PhotonImage)};
