// Every test runs with the native kernels loaded, as the studio and the breeding workers do.
import { loadKernels } from '../src/kernels';

await loadKernels();
