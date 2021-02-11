import {DataType} from '@blinkk/selective-edit/dist/src/utility/dataType';

export interface DeepCleanConfig {
  removeEmptyObjects?: boolean;
}

type CleanableType = Record<string, any> | Array<any>;

export class DeepClean {
  config: DeepCleanConfig;

  constructor(config: DeepCleanConfig) {
    this.config = config;
  }

  clean(value: CleanableType): CleanableType {
    if (DataType.isObject(value)) {
      return this.cleanRecord(value as Record<string, any>);
    } else if (DataType.isArray(value)) {
      return this.cleanArray(value as Array<any>);
    }

    return value;
  }

  protected cleanArray(originalValue: Array<any>): Array<any> {
    const newValue: Array<any> = [];

    for (let value of originalValue) {
      if (DataType.isObject(value)) {
        // Clean in depth before testing for cleaning.
        value = this.cleanRecord(value);

        if (this.config.removeEmptyObjects && !Object.keys(value).length) {
          continue;
        }
        newValue.push(value);
      } else {
        newValue.push(value);
      }
    }

    return newValue;
  }

  protected cleanRecord(
    originalValue: Record<string, any>
  ): Record<string, any> {
    const newValue: Record<string, any> = {};

    // eslint-disable-next-line prefer-const
    for (let [key, value] of Object.entries(originalValue)) {
      if (DataType.isObject(value)) {
        // Clean in depth before testing for cleaning.
        value = this.cleanRecord(value);

        if (this.config.removeEmptyObjects && !Object.keys(value).length) {
          continue;
        }
        newValue[key] = value;
      } else {
        newValue[key] = value;
      }
    }

    return newValue;
  }
}
