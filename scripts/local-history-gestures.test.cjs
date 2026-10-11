const fs = require('fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const babel = require('@babel/core');
let gesture, deleted=[], restored=[];
const jsx=(type,props)=>({type,props});
const modules={
 react:{useRef: current=>({current})},
 'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-i18next':{useTranslation:()=>({t:x=>x})},
 'react-native':{Animated:{Value:class{setValue(){}},View:'Animated',spring:()=>({start(){}})},PanResponder:{create:handlers=>{gesture=handlers;return {panHandlers:{}}}},StyleSheet:{create:x=>x},View:'View',Text:'Text',ScrollView:'ScrollView'},
 './SoundPressable':{__esModule:true,default:'Pressable'},'../calculatorUtils':{pretty:String},
};
const code=babel.transformSync(fs.readFileSync('components/LocalCalculationHistory.js','utf8')+'\nexport { HistoryRow };',{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs',['@babel/plugin-transform-react-jsx',{runtime:'automatic'}]]}).code;
const exportsObject={};vm.runInNewContext(code,{exports:exportsObject,require:name=>modules[name]});
const row=exportsObject.HistoryRow({entry:{id:'one',expression:'2 + 3',result:'5'},onRestore:value=>restored.push(value),onDelete:id=>deleted.push(id)});
const press=row.props.children.props.children.props;
assert.equal(gesture.onMoveShouldSetPanResponder(null,{dx:10,dy:50}),false);
assert.equal(gesture.onMoveShouldSetPanResponder(null,{dx:40,dy:5}),true);
press.onPressIn();press.onPress();assert.deepEqual(restored,['2 + 3']);
for(const dx of [-90,90]){press.onPressIn();gesture.onPanResponderGrant();gesture.onPanResponderRelease(null,{dx});press.onPress()}
assert.deepEqual(deleted,['one','one']);assert.equal(restored.length,1);
gesture.onPanResponderRelease(null,{dx:30});assert.equal(deleted.length,2);
console.log('PASS: tap restores, both swipe directions delete, short/vertical movement does not delete');
const translations=require('../locales/localHistory.json');
for(const messages of Object.values(translations))assert.deepEqual(Object.keys(messages).sort(),Object.keys(translations.en).sort());
