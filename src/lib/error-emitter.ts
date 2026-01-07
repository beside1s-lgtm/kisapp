import { EventEmitter } from 'events';

// It's a good practice to type your events.
interface TypedEventEmitter extends EventEmitter {
  emit(event: 'permission-error', error: Error): boolean;
  on(event: 'permission-error', listener: (error: Error) => void): this;
}

export const errorEmitter: TypedEventEmitter = new EventEmitter();
