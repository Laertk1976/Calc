const fs = require('fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const babel = require('@babel/core');
const utilsExports = {};
vm.runInNewContext(babel.transformSync(fs.readFileSync('calculatorUtils.js','utf8'), {configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code, {exports:utilsExports});
const states = []; let cursor=0; const recorded=[];
const jsx=(type,props)=>({type,props});
const mock = {
 react:{useState: initial=>{const index=cursor++;if(!(index in states)) states[index]=initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}];},useEffect(){}},
 'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-i18next':{useTranslation:()=>({t:x=>x})},
 'react-native':{Alert:{alert(){throw Error('Unexpected alert')}},AppState:{}},
 'react-native-safe-area-context':{SafeAreaProvider:'SafeAreaProvider'},
 './components/ProProvider':{__esModule:true,default:'ProProvider',usePro:()=>({hasPro:true,today:'today',requirePro:()=>true})},
 './calculatorConstants':{operators:['+','\u2212','\u00d7','\u00f7']},
 './calculatorUtils':utilsExports,
 './proAccess':{accessibleRecords:x=>x},
 './localCalculationHistory':{createLocalCalculationHistory:()=>({add:(...entry)=>{recorded.push(entry);return Promise.resolve()},remove:()=>Promise.resolve()})},
 './authClient':{auth:null},
 './components/CalculatorView':{__esModule:true,default:'CalculatorView'},
};
const exportsObject={};
const code=babel.transformSync(fs.readFileSync('App.js','utf8')+'\nexport { AppContent };',{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs',['@babel/plugin-transform-react-jsx',{runtime:'automatic'}]]}).code;
vm.runInNewContext(code,{exports:exportsObject,require:name=>mock[name]||{}});
function find(node){if(!node)return;if(node.type==='CalculatorView')return node.props;for(const child of [node.props?.children].flat()){const result=find(child);if(result)return result}}
function render(){cursor=0;return find(exportsObject.AppContent())}
function press(...keys){for(const key of keys)render().onKeyPress(key)}
press('1','8','0','\u00d7','7','5','+','5','\u00d7','9','0','0','=');
assert.equal(recorded[0][1],18000);
press('=','=');assert.equal(recorded.length,1);
press('2','+','3','=');assert.equal(recorded.length,2);assert.equal(recorded[1][0],'2 + 3');assert.equal(recorded[1][1],5);
render().onEditExpression(recorded[0][0]);assert.equal(recorded.length,2);assert.equal(render().display,'18000');
press('+','1','=');assert.equal(recorded[2][1],18001);
console.log('PASS: completion, repeated equals, next calculation, restore and reuse');
