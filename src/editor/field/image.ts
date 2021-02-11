import {
  DeepObject,
  DroppableMixin,
  Field,
  FieldComponent,
  FieldConfig,
  SelectiveEditor,
  TemplateResult,
  Types,
  classMap,
  html,
} from '@blinkk/selective-edit';
import {FileData} from '../api';
import {LiveEditorGlobalConfig} from '../editor';
import merge from 'lodash.merge';

export const EXT_TO_MIME_TYPE: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpg',
  jpg: 'image/jpg',
  mp4: 'image/mp4',
  mov: 'image/mov',
  png: 'image/png',
  svg: 'image/svg+xml',
  webm: 'image/webm',
  webp: 'image/webp',
};
export const VALID_IMAGE_MIME_TYPES = [
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
];
export const VALID_VIDEO_MIME_TYPES = ['image/mp4', 'image/mov', 'image/webm'];

export interface ImageFieldConfig extends FieldConfig {
  /**
   * Placeholder for the text input.
   */
  placeholder?: string;
}

export interface ImageFieldComponent extends FieldComponent {
  handleFiles(files: Array<File>): void;
}

export interface ImageMeta {
  height: number;
  width: number;
}

export class ImageField
  extends DroppableMixin(Field)
  implements ImageFieldComponent {
  config: ImageFieldConfig;
  globalConfig: LiveEditorGlobalConfig;
  meta?: ImageMeta;

  constructor(
    types: Types,
    config: ImageFieldConfig,
    globalConfig: LiveEditorGlobalConfig,
    fieldType = 'image'
  ) {
    super(types, config, globalConfig, fieldType);
    this.config = config;
    this.globalConfig = globalConfig;
    this.droppableUi.validTypes = [
      ...VALID_IMAGE_MIME_TYPES,
      ...VALID_VIDEO_MIME_TYPES,
    ];
    this.droppableUi.listeners.add('files', this.handleFiles.bind(this));
  }

  /**
   * Retrieve the url for previewing the field.
   */
  get previewUrl(): string | undefined {
    const value = this.currentValue || {};
    if (!value || !value.url) {
      return undefined;
    }
    return value.url;
  }

  handleFiles(files: Array<File>) {
    // Uploads only the first file.
    this.globalConfig.api.uploadFile(files[0]).then((file: FileData) => {
      this.currentValue = merge({}, this.currentValue || {}, {
        url: file.url,
      });

      this.render();
    });
  }

  /**
   * Handle when the input changes value.
   *
   * @param evt Input event from changing value.
   */
  handleInput(evt: Event) {
    const target = evt.target as HTMLInputElement;
    this.currentValue = merge({}, this.currentValue || {}, {
      _meta: this.meta,
      url: target.value,
    });
    this.render();
  }

  handlePreviewImageLoad(evt: Event) {
    const target = evt.target as HTMLImageElement;
    this.meta = {
      height: target.naturalHeight,
      width: target.naturalWidth,
    };

    this.currentValue = merge({}, this.currentValue || {}, {
      _meta: this.meta,
    });

    this.render();
  }

  handlePreviewVideoLoad(evt: Event) {
    const target = evt.target as HTMLVideoElement;
    this.meta = {
      height: target.videoHeight,
      width: target.videoWidth,
    };

    this.currentValue = merge({}, this.currentValue || {}, {
      _meta: this.meta,
    });

    this.render();
  }

  templateInput(editor: SelectiveEditor, data: DeepObject): TemplateResult {
    const value = this.currentValue || {};
    return html`${this.templateHelp(editor, data)}
      <div
        class="selective__droppable__target"
        @dragenter=${this.droppableUi.handleDragEnter.bind(this.droppableUi)}
        @dragleave=${this.droppableUi.handleDragLeave.bind(this.droppableUi)}
        @dragover=${this.droppableUi.handleDragOver.bind(this.droppableUi)}
        @drop=${this.droppableUi.handleDrop.bind(this.droppableUi)}
      >
        <input
          class=${classMap(this.classesForInput())}
          type="text"
          id="${this.uid}"
          placeholder=${this.config.placeholder || ''}
          @input=${this.handleInput.bind(this)}
          value=${value.url || ''}
        />
        ${this.templatePreview(editor, data)}
      </div>
      ${this.templateErrors(editor, data)}`;
  }

  templatePreview(editor: SelectiveEditor, data: DeepObject): TemplateResult {
    return html`<div class="selective__media__preview">
      ${this.templatePreviewMedia(editor, data, this.previewUrl)}
      ${this.templatePreviewMeta(editor, data)}
    </div>`;
  }

  templatePreviewMedia(
    editor: SelectiveEditor,
    data: DeepObject,
    url?: string
  ): TemplateResult {
    if (!url) {
      return html``;
    }

    for (const fileExt of Object.keys(EXT_TO_MIME_TYPE)) {
      const extMimeType = EXT_TO_MIME_TYPE[fileExt];
      const isVideoFile = VALID_VIDEO_MIME_TYPES.includes(extMimeType);
      if (isVideoFile && url.endsWith(`.${fileExt}`)) {
        return html`<video
          data-serving-path=${url}
          @loadeddata=${this.handlePreviewVideoLoad.bind(this)}
          playsinline
          disableremoteplayback
          muted
          autoplay
          loop
        >
          <source src="${url}" />
        </video>`;
      }
    }

    return html`<img
      data-serving-path=${url}
      @load=${this.handlePreviewImageLoad.bind(this)}
      src="${url}"
    />`;
  }

  templatePreviewMeta(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    editor: SelectiveEditor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    data: DeepObject
  ): Array<TemplateResult> {
    if (!this.meta) {
      if (!this.currentValue?._meta) {
        return [html``];
      }
      this.meta = this.currentValue._meta;
    }

    const metaInfo: Array<TemplateResult> = [];

    metaInfo.push(html`<div class="selective__media__meta__size">
      <span class="selective__media__meta__label">Size:</span>
      <span class="selective__media__meta__value"
        >${this.meta?.width} x ${this.meta?.height}</span
      >
    </div>`);

    const ratio = fractReduce(this.meta?.width || 1, this.meta?.height || 1);
    metaInfo.push(html`<div class="selective__media__meta__ratio">
      <span class="selective__media__meta__label">Ratio:</span>
      <span class="selective__media__meta__value">${ratio[0]}:${ratio[1]}</span>
    </div>`);

    return metaInfo;
  }
}

/**
 * Find the greatest common denominator between two numbers.
 * @param numerator Fraction numerator.
 * @param denominator Fraction denominator.
 */
function greatestCommonDenominator(
  numerator: number,
  denominator: number
): number {
  return denominator
    ? greatestCommonDenominator(denominator, numerator % denominator)
    : numerator;
}

/**
 * Reduce a fraction by finding the Greatest Common Divisor and dividing by it.
 * @param numerator Fraction numerator.
 * @param denominator Fraction denominator.
 */
function fractReduce(numerator: number, denominator: number): Array<number> {
  const fracGcd = greatestCommonDenominator(numerator, denominator);
  return [numerator / fracGcd, denominator / fracGcd];
}
