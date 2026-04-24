declare module 'mammoth/mammoth.browser' {
    export interface Options {
        arrayBuffer: ArrayBuffer;
    }
    export interface Result {
        value: string;
        messages: any[];
    }
    export function convertToHtml(options: Options): Promise<Result>;
}
