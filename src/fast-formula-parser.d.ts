declare module 'fast-formula-parser' { export default class FormulaParser { constructor(options: any); parse(formula: string, position: {sheet:string;row:number;col:number}): any; } }
