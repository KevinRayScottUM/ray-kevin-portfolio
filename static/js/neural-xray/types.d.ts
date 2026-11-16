export type ExecutionMode='live-browser'|'recorded-real-trace'|'analytical-demonstration';
export interface TensorRecord{id:string;shape:number[];dtype:string;values:Float32Array;min:number;max:number;mean:number;role:string;complete:boolean;}
export interface ExecutionStep{id:string;layerId:string;operation:string;title:[string,string];description:[string,string];formula:string;inputs:string[];outputs:string[];}
export interface ExplanationTrace{architecture:string;executionMode:ExecutionMode;provenance:string;steps:ExecutionStep[];tensors:Record<string,TensorRecord>;parameters:number;iteration:number;metrics:Record<string,number>;visual:Record<string,unknown>;}
export interface ModelExplanationAdapter{id:string;load(id:string,options?:Record<string,unknown>):Promise<void>;run(input?:unknown,options?:Record<string,unknown>):ExplanationTrace;getTensor(id:string):TensorRecord|undefined;train(count:number):void;reset():Promise<void>;dispose():void;}
