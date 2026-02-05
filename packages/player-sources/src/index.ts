// Types
export type {
    SourceAdapter,
    SourceAdapterConfig,
    SegmentLoadedCallback,
    ErrorCallback,
    LiveStreamInfo,
} from './types';

// Adapters
export { HLSAdapter, type HLSAdapterConfig } from './hls-adapter';
export { HLSNativeAdapter } from './hls-native-adapter';
export { DASHAdapter, type DASHAdapterConfig } from './dash-adapter';
export { MP4Adapter } from './mp4-adapter';

// Factory
export {
    createSourceAdapter,
    detectSourceType,
    shouldUseNativeHLS,
    getSupportedSourceTypes,
    isSourceTypeSupported,
    type SourceFactoryConfig,
} from './source-factory';
