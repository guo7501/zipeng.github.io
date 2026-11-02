import {categories,surfaces,commonMaintenanceReferences} from './data.mjs';
export const initialState=()=>({surface:'mulch',step:'overview',labor:'both',summaryScenario:0,customProducts:{},productSelections:{},customLaborOptions:{},laborSelections:{},customMaintenanceLaborOptions:{},maintenanceLaborSelections:{},overrides:{}});
export const has=(s,k)=>Object.hasOwn(s.overrides,k);
export const val=(s,k,d)=>has(s,k)?s.overrides[k]:d;
export const num=(s,k,d)=>{const x=Number(val(s,k,d));return Number.isFinite(x)?x:0;};
export const safeDiv=(a,b)=>b>0?a/b:0;
export const area=s=>num(s,'area',num(s,'length',0)>0&&num(s,'width',0)>0?num(s,'length',0)*num(s,'width',0):20000);
export const edge=s=>num(s,'edge',num(s,'length',0)>0?2*num(s,'length',0):0);
export function categoryCoverage(s,key){const c=categories[key];let d=c.coverage;if(c.depth){const dep=num(s,`cat.${key}.depth`,c.depth);d=key==='ASPH_SURF'?safeDiv(num(s,'asphalt.tonWeight',2000),num(s,'asphalt.density',110)*dep)*num(s,'asphalt.sqyd',9):safeDiv(12,dep);}if(key==='ASPH_TREAT')d=safeDiv(num(s,'asphalt.sealerArea',300),num(s,'asphalt.sealerPail',4.75));return num(s,`cat.${key}.coverage`,d);}
export const allProducts=(s,key)=>[...categories[key].products,...(s.customProducts?.[key]||[])];
export function product(s,key,i){const p=allProducts(s,key)[i],pre=`prod.${key}.${i}`;const listed=p.listed==null&&!has(s,`${pre}.listed`)?null:num(s,`${pre}.listed`,p.listed),pack=num(s,`${pre}.pack`,p.pack??1);const autoPrice=(has(s,`${pre}.listed`)||has(s,`${pre}.pack`))?safeDiv(listed,pack):p.price;const price=num(s,`${pre}.price`,autoPrice);const cov=num(s,`${pre}.coverage`,p.coverage??categoryCoverage(s,key));return {...p,name:val(s,`${pre}.name`,p.name),listed,pack,autoPrice,price,coverage:cov,cost:safeDiv(price,cov)};}
export function category(s,key){const c=categories[key],products=allProducts(s,key).map((_,i)=>({...product(s,key,i),selected:!s.productSelections?.[key]||s.productSelections[key].includes(i)})),selected=products.filter(p=>p.selected),average=selected.reduce((a,p)=>a+p.cost,0)/selected.length;return {...c,products,selectedCount:selected.length,average,cost:num(s,`cat.${key}.cost`,average),coverage:categoryCoverage(s,key),thickness:val(s,`cat.${key}.thickness`,c.depth?`${num(s,`cat.${key}.depth`,c.depth)} in.${key==='ASPH_SURF'?' compacted (over '+num(s,'asphalt.baseDepth',6)+' in. aggregate base)':''}`:c.thickness)};}
function useProductAverage(s,key){delete s.overrides[`cat.${key}.cost`];for(const [id,surface] of Object.entries(surfaces))for(const a of surface.activities)if(a.category===key)delete s.overrides[`${id}.activity.${a.id}.materialCost`];}
export function selectProduct(s,key,index,checked){if(!categories[key]||!Number.isInteger(index)||index<0||index>=allProducts(s,key).length)throw new Error('Unknown product.');const selected=new Set(s.productSelections?.[key]??allProducts(s,key).map((_,i)=>i));checked?selected.add(index):selected.delete(index);if(!selected.size)throw new Error('Keep at least one product selected for the average.');(s.productSelections??={})[key]=[...selected];useProductAverage(s,key);}
export function addCustomerProduct(s,key,input){if(!categories[key])throw new Error('Unknown material category.');const name=String(input.name??'').trim(),contributor=String(input.contributor??'').trim(),listed=Number(input.listed),pack=Number(input.pack),coverage=Number(input.coverage);if(!name||!contributor)throw new Error('Enter the product name and contributor name.');if(![listed,pack,coverage].every(Number.isFinite)||listed<=0||pack<=0||coverage<=0)throw new Error('Package price, quantity, and coverage must be greater than zero.');const index=allProducts(s,key).length;(s.customProducts??={})[key]??=[];s.customProducts[key].push({name,contributor,listed,pack,coverage,price:listed/pack,source:String(input.source??'').trim()||'Customer-provided product',custom:true});(s.productSelections??={})[key]=[index];useProductAverage(s,key);return index;}
export function deleteCustomerProduct(s,key,index){const base=categories[key]?.products.length;if(base===undefined||!Number.isInteger(index)||index<base||index>=allProducts(s,key).length)throw new Error('Only customer-added products can be deleted.');const selected=s.productSelections?.[key]??allProducts(s,key).map((_,i)=>i);s.customProducts[key].splice(index-base,1);const prefix=`prod.${key}.`,next={};for(const [k,v] of Object.entries(s.overrides)){if(!k.startsWith(prefix)){next[k]=v;continue;}const rest=k.slice(prefix.length),dot=rest.indexOf('.'),i=Number(rest.slice(0,dot));if(i===index)continue;next[prefix+(i>index?i-1:i)+rest.slice(dot)]=v;}s.overrides=next;let remaining=selected.filter(i=>i!==index).map(i=>i>index?i-1:i);const fallback=!remaining.length;if(fallback)remaining=categories[key].products.map((_,i)=>i);(s.productSelections??={})[key]=remaining;useProductAverage(s,key);return {fallback};}
const pair=(s,pre,defaults)=>['low','high'].map((k,i)=>num(s,`${pre}.${k}`,defaults?.[i]??0));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,k)=>a.map(v=>v*k);
export const customLaborOptions=(s,id,mode)=>(s.customLaborOptions?.[id]||[]).filter(x=>x.mode===mode);
export function addCustomerLaborOption(s,id,input){
 if(!surfaces[id])throw new Error('Unknown trail surface.');
 const mode=String(input.mode??''),name=String(input.name??'').trim(),contributor=String(input.contributor??'').trim(),lowHourly=Number(input.lowHourly),highHourly=Number(input.highHourly),sqftPerHour=Number(input.sqftPerHour);
 if(!['ih','out'].includes(mode))throw new Error('Choose In-house or Outsourced.');
 if(!name||!contributor)throw new Error('Enter the crew or contractor name and the contributor name.');
 if(![lowHourly,highHourly,sqftPerHour].every(Number.isFinite)||lowHourly<=0||highHourly<=0||sqftPerHour<=0)throw new Error('Hourly rates and area completed per worker-hour must be greater than zero.');
 if(highHourly<lowHourly)throw new Error('High hourly rate must be equal to or greater than the low hourly rate.');
 (s.customLaborOptions??={})[id]??=[];
 const record={mode,name,contributor,lowHourly,highHourly,sqftPerHour,custom:true};
 s.customLaborOptions[id].push(record);
 const index=customLaborOptions(s,id,mode).length-1;
 (s.laborSelections??={})[id]??={};s.laborSelections[id][mode]=index;
 return index;
}
export function selectLaborOption(s,id,mode,index){
 if(!surfaces[id]||!['ih','out'].includes(mode))throw new Error('Unknown labor option.');
 if(index!=='default'&&(!Number.isInteger(index)||index<0||index>=customLaborOptions(s,id,mode).length))throw new Error('Unknown labor option.');
 (s.laborSelections??={})[id]??={};s.laborSelections[id][mode]=index;
}
export function deleteCustomerLaborOption(s,id,mode,index){
 const all=s.customLaborOptions?.[id]||[],matches=all.map((x,i)=>({x,i})).filter(({x})=>x.mode===mode);
 if(!Number.isInteger(index)||index<0||index>=matches.length)throw new Error('Unknown labor option.');
 all.splice(matches[index].i,1);
 const selected=s.laborSelections?.[id]?.[mode];
 if(selected===index)s.laborSelections[id][mode]='default';
 else if(Number.isInteger(selected)&&selected>index)s.laborSelections[id][mode]=selected-1;
}
export function constructionLaborRate(s,id,mode){
 const selected=s.laborSelections?.[id]?.[mode]??'default',custom=customLaborOptions(s,id,mode);
 if(selected!=='default'&&custom[selected]){const x=custom[selected];return {name:x.name,contributor:x.contributor,hourly:[x.lowHourly,x.highHourly],sqftPerHour:x.sqftPerHour,hoursPerSqft:safeDiv(1,x.sqftPerHour),rates:[safeDiv(x.lowHourly,x.sqftPerHour),safeDiv(x.highHourly,x.sqftPerHour)],custom:true,index:selected};}
 return {name:mode==='ih'?'In-house crew':'Outsourced (contractor)',rates:pair(s,`${id}.construction.${mode}`,surfaces[id][mode]),custom:false,index:'default'};
}
export const customMaintenanceLaborOptions=(s,id,activityId,mode)=>(s.customMaintenanceLaborOptions?.[id]?.[activityId]||[]).filter(x=>x.mode===mode);
export function addCustomerMaintenanceLaborOption(s,id,activityId,input){
 if(!surfaces[id]||!activityId)throw new Error('Unknown maintenance activity.');
 const mode=String(input.mode??''),name=String(input.name??'').trim(),contributor=String(input.contributor??'').trim(),lowHourly=Number(input.lowHourly),highHourly=Number(input.highHourly),productivity=Number(input.productivity);
 if(!['ih','out'].includes(mode))throw new Error('Choose In-house or Outsourced.');
 if(!name||!contributor)throw new Error('Enter the crew or contractor name and the contributor name.');
 if(![lowHourly,highHourly,productivity].every(Number.isFinite)||lowHourly<=0||highHourly<=0||productivity<=0)throw new Error('Hourly rates and work completed per worker-hour must be greater than zero.');
 if(highHourly<lowHourly)throw new Error('High hourly rate must be equal to or greater than the low hourly rate.');
 s.customMaintenanceLaborOptions??={};s.customMaintenanceLaborOptions[id]??={};s.customMaintenanceLaborOptions[id][activityId]??=[];
 s.customMaintenanceLaborOptions[id][activityId].push({mode,name,contributor,lowHourly,highHourly,productivity,custom:true});
 const index=customMaintenanceLaborOptions(s,id,activityId,mode).length-1;
 s.maintenanceLaborSelections??={};s.maintenanceLaborSelections[id]??={};s.maintenanceLaborSelections[id][activityId]??={};s.maintenanceLaborSelections[id][activityId][mode]=index;
 return index;
}
export function selectMaintenanceLaborOption(s,id,activityId,mode,index){
 if(!surfaces[id]||!activityId||!['ih','out'].includes(mode))throw new Error('Unknown maintenance labor option.');
 if(index!=='default'&&(!Number.isInteger(index)||index<0||index>=customMaintenanceLaborOptions(s,id,activityId,mode).length))throw new Error('Unknown maintenance labor option.');
 s.maintenanceLaborSelections??={};s.maintenanceLaborSelections[id]??={};s.maintenanceLaborSelections[id][activityId]??={};s.maintenanceLaborSelections[id][activityId][mode]=index;
}
export function deleteCustomerMaintenanceLaborOption(s,id,activityId,mode,index){
 const all=s.customMaintenanceLaborOptions?.[id]?.[activityId]||[],matches=all.map((x,i)=>({x,i})).filter(({x})=>x.mode===mode);
 if(!Number.isInteger(index)||index<0||index>=matches.length)throw new Error('Unknown maintenance labor option.');
 all.splice(matches[index].i,1);
 const selected=s.maintenanceLaborSelections?.[id]?.[activityId]?.[mode];
 if(selected===index)s.maintenanceLaborSelections[id][activityId][mode]='default';
 else if(Number.isInteger(selected)&&selected>index)s.maintenanceLaborSelections[id][activityId][mode]=selected-1;
}
export function maintenanceLaborRate(s,id,a,mode){
 const selected=s.maintenanceLaborSelections?.[id]?.[a.id]?.[mode]??'default',custom=customMaintenanceLaborOptions(s,id,a.id,mode);
 if(selected!=='default'&&custom[selected]){const x=custom[selected];return {name:x.name,contributor:x.contributor,hourly:[x.lowHourly,x.highHourly],productivity:x.productivity,rates:[safeDiv(x.lowHourly,x.productivity),safeDiv(x.highHourly,x.productivity)],custom:true,index:selected,missing:false};}
 const missing=!a[mode]&&!has(s,`${id}.activity.${a.id}.${mode}.low`)&&!has(s,`${id}.activity.${a.id}.${mode}.high`);
 return {name:mode==='ih'?'In-house crew':'Outsourced (contractor)',rates:pair(s,`${id}.activity.${a.id}.${mode}`,a[mode]),custom:false,index:'default',missing};
}
export const adjusted=(s,r)=>[r[0]*(1+num(s,'adj.low',-15)/100),r[1]*(1+num(s,'adj.high',15)/100)];
export function calculate(s,id=s.surface){
 const f=surfaces[id],A=area(s),C=num(s,`${id}.cycle`,f.cycle),prod=num(s,`${id}.productivity`,f.productivity),workerHours=safeDiv(A,prod);
 const laborOptions={ih:constructionLaborRate(s,id,'ih'),out:constructionLaborRate(s,id,'out')},rates={ih:laborOptions.ih.rates,out:laborOptions.out.rates};
 const layers=f.layers.map(key=>{const cat=category(s,key),d=cat.unit==='lin. ft.'?edge(s):A;const quantity=num(s,`${id}.quantity.${key}`,d),replacementQty=num(s,`${id}.replacement.${key}`,quantity);return {key,...cat,quantity,defaultQuantity:d,replacementQty,total:quantity*cat.cost,replacementTotal:replacementQty*cat.cost};});
 const material=layers.reduce((n,x)=>n+x.total,0),replacementMaterial=layers.reduce((n,x)=>n+x.replacementTotal,0);
 const construction={material,ih:add([material,material],scale(rates.ih,A)),out:add([material,material],scale(rates.out,A)),labor:{ih:scale(rates.ih,A),out:scale(rates.out,A)}};
 const demoRates=pair(s,`${id}.demo`,f.demo),demo=scale(demoRates,A),replacement={material:replacementMaterial,labor:{ih:scale(rates.ih,A),out:scale(rates.out,A)}};
 for(const m of ['ih','out'])replacement[m]=add(add([replacementMaterial,replacementMaterial],replacement.labor[m]),demo);
 const hourlyDefault=safeDiv(construction.labor.ih[0],workerHours),hourly=num(s,`${id}.hourly`,hourlyDefault),fteNom=num(s,'fte.nominal',2080),fteReal=num(s,'fte.realistic',1800);
 const referenceRate=r=>r.hourly.map(x=>safeDiv(x,r.productivity)),routineRef=commonMaintenanceReferences.routine,weedRef=commonMaintenanceReferences.weed;
 const common=[{id:'routine',name:'Routine inspection, debris removal, drainage cleaning',visits:f.visits,ih:referenceRate(routineRef),out:routineRef.out,visitBased:true,reference:routineRef},...(f.weeds?[{id:'weed',name:'Weed control / spot treatment',visits:12,services:1,ih:referenceRate(weedRef),out:weedRef.out,visitBased:true,serviceBased:true,reference:weedRef}]:[])];
 const scenarios=[0,1].map(n=>{
  const fraction=num(s,`scenario.${n}.maintained`,n===0?100:40)/100,replaced=n===0?1-fraction:num(s,'scenario.1.rebuilt',100)/100,MA=A*fraction;
  const acts=[...common,...f.activities].map(a=>{
   const prefix=`${id}.activity.${a.id}`,interval=a.visitBased?safeDiv(1,num(s,`${prefix}.visits`,a.visits)):a.interval==null?null:num(s,`${prefix}.interval`,a.interval);
   const share=a.visitBased?num(s,`${prefix}.visits`,a.visits):interval==null?num(s,'condition',5)/100:interval>=C?0:safeDiv(1,C);
   const linear=['crack','joint','edge'].includes(a.basis),autoBasis=a.serviceBased?num(s,`${prefix}.services`,a.services??1)*fraction:a.basis==='edge'?edge(s):a.basis==='crack'||a.basis==='joint'?num(s,`${id}.${a.basis}`,0):a.basis==='remesh'?num(s,`${id}.remesh.${n}`,MA):MA;
   const basis=num(s,`${prefix}.basis.${n}`,autoBasis),quantity=share*basis,ihQuantity=a.serviceBased?quantity:a.basis==='edge'?quantity:share*MA,outQuantity=a.serviceBased?quantity:linear?quantity:share*MA;
   const unit=a.serviceBased?'service':linear?'lin. ft.':'sq. ft.';
   const cat=a.category?category(s,a.category):null,cost=cat?num(s,`${prefix}.materialCost`,cat.cost):0,mat=quantity*cost;
   const laborOptions={ih:maintenanceLaborRate(s,id,a,'ih'),out:maintenanceLaborRate(s,id,a,'out')},ihRate=laborOptions.ih.rates,outRate=laborOptions.out.rates;
   const missing=laborOptions.out.missing;
   const annual={material:mat,labor:{ih:scale(ihRate,ihQuantity),out:scale(outRate,outQuantity)}};
   for(const m of ['ih','out'])annual[m]=add([mat,mat],annual.labor[m]);
   const full={material:mat*C,labor:{ih:scale(annual.labor.ih,C),out:scale(annual.labor.out,C)},ih:scale(annual.ih,C),out:scale(annual.out,C)};
   const times=a.visitBased?Math.floor(C*share):interval==null?C:Math.max(1,Math.floor(safeDiv(C,interval)));
   const productivityDefault=safeDiv(hourly,ihRate[0]),productivity=num(s,`${prefix}.productivity`,productivityDefault),hours=safeDiv(ihQuantity,productivity);
   return {...a,prefix,interval,share,basis,autoBasis,quantity,ihQuantity,outQuantity,unit,cost,ihRate,outRate,laborOptions,missing,annual,full,times,productivityDefault,productivity,hours};
  });
  const annual={material:acts.reduce((t,x)=>t+x.annual.material,0),labor:{ih:[0,0],out:[0,0]}};
  for(const a of acts)for(const m of ['ih','out'])annual.labor[m]=add(annual.labor[m],a.annual.labor[m]);
  const full={material:annual.material*C,labor:{ih:scale(annual.labor.ih,C),out:scale(annual.labor.out,C)}};const total={},perYear={};
  for(const m of ['ih','out']){annual[m]=add([annual.material,annual.material],annual.labor[m]);full[m]=scale(annual[m],C);total[m]=add(add(construction[m],full[m]),scale(replacement[m],replaced));perYear[m]=scale(total[m],safeDiv(1,C));}
  const annualHours=acts.reduce((t,x)=>t+x.hours,0),demolitionProductivity=num(s,`${id}.demoProductivity`,0),replacementHours=(workerHours+safeDiv(A,demolitionProductivity))*replaced;
  return {fraction,replaced,MA,activities:acts,annual,full,total,perYear,annualHours,replacementHours,fte:{annualNom:safeDiv(annualHours,fteNom),annualReal:safeDiv(annualHours,fteReal),replacementNom:safeDiv(replacementHours,fteNom),replacementReal:safeDiv(replacementHours,fteReal),peakNom:safeDiv(annualHours+replacementHours,fteNom),peakReal:safeDiv(annualHours+replacementHours,fteReal)}};
 });
 return {id,surface:f,A,C,prod,rates,laborOptions,layers,construction,demo,demoRates,replacement,workerHours,hourly,hourlyDefault,scenarios,fteNom,fteReal,constructionFte:safeDiv(workerHours,fteNom),constructionReal:safeDiv(workerHours,fteReal)};
}
export function comparison(s){return Object.keys(surfaces).map(id=>calculate(s,id));}
export function exportRows(s){const rows=[['Feasibility Toolbox — Texas pricing July 2026'],['Area (sq. ft.)',area(s)],['Surface','Cycle years','Scenario','Labor','Construction low USD','Construction high USD','Annual maintenance low USD','Annual maintenance high USD','Lifecycle low USD','Lifecycle high USD','Annual ownership low USD','Annual ownership high USD','Adjusted lifecycle low USD','Adjusted lifecycle high USD']];for(const c of comparison(s))for(const [i,sc] of c.scenarios.entries())for(const m of ['ih','out'])rows.push([c.surface.name,c.C,`Scenario ${i+1}`,m==='ih'?'In-house':'Outsourced',...c.construction[m],...sc.annual[m],...sc.total[m],...sc.perYear[m],...adjusted(s,sc.total[m])]);rows.push([],['Selected surface detail',surfaces[s.surface].name],['Component','Scenario','Labor','Low USD','High USD']);const c=calculate(s);for(const [i,sc] of c.scenarios.entries())for(const m of ['ih','out']){rows.push(['Construction material',i+1,m,c.construction.material,c.construction.material],['Construction labor',i+1,m,...c.construction.labor[m]],['Maintenance material full cycle',i+1,m,sc.full.material,sc.full.material],['Maintenance labor full cycle',i+1,m,...sc.full.labor[m]],['Removal and haul-away',i+1,m,...c.demo.map(x=>x*sc.replaced)],['Replacement material',i+1,m,c.replacement.material*sc.replaced,c.replacement.material*sc.replaced],['Replacement labor',i+1,m,...c.replacement.labor[m].map(x=>x*sc.replaced)]);for(const a of sc.activities)rows.push([`Annual: ${a.name}`,i+1,m,...a.annual[m]]);}rows.push([],['Customer-added construction labor'],['Trail surface','Labor option','Crew or contractor','Added by','Low hourly rate USD','High hourly rate USD','Area completed per worker-hour (sq. ft.)','Low rate per sq. ft. USD','High rate per sq. ft. USD','Currently selected']);for(const [id,f] of Object.entries(surfaces))for(const mode of ['ih','out'])for(const [i,x] of customLaborOptions(s,id,mode).entries())rows.push([f.name,mode==='ih'?'In-house':'Outsourced',x.name,x.contributor,x.lowHourly,x.highHourly,x.sqftPerHour,safeDiv(x.lowHourly,x.sqftPerHour),safeDiv(x.highHourly,x.sqftPerHour),(s.laborSelections?.[id]?.[mode]??'default')===i?'Yes':'No']);rows.push([],['Customer-added maintenance labor'],['Trail surface','Maintenance activity','Labor option','Crew or contractor','Added by','Low hourly rate USD','High hourly rate USD','Work completed per worker-hour','Low activity rate','High activity rate','Currently selected']);for(const [id,f] of Object.entries(surfaces))for(const [activityId,records] of Object.entries(s.customMaintenanceLaborOptions?.[id]||{}))for(const mode of ['ih','out'])for(const [i,x] of records.filter(y=>y.mode===mode).entries()){const activityName=activityId==='routine'?'Routine inspection, debris removal, drainage cleaning':activityId==='weed'?'Weed control / spot treatment':f.activities.find(a=>a.id===activityId)?.name||activityId;rows.push([f.name,activityName,mode==='ih'?'In-house':'Outsourced',x.name,x.contributor,x.lowHourly,x.highHourly,x.productivity,safeDiv(x.lowHourly,x.productivity),safeDiv(x.highHourly,x.productivity),(s.maintenanceLaborSelections?.[id]?.[activityId]?.[mode]??'default')===i?'Yes':'No']);}rows.push([],['Product pricing selections'],['Category','Product','Contributor','Source','Included in average','Package price USD','Package quantity','Price per purchase unit USD','Coverage per purchase unit','Estimating unit','Converted unit price USD']);for(const key of Object.keys(categories))for(const p of category(s,key).products)rows.push([categories[key].name,p.name,p.contributor||'',p.source,p.selected?'Yes':'No',p.listed,p.pack,p.price,p.coverage,categories[key].unit,p.cost]);rows.push([],['Edited input','Value']);for(const [k,v] of Object.entries(s.overrides))rows.push([k,v]);return rows;}
export const toCSV=rows=>rows.map(row=>row.map(x=>'"'+(typeof x==='string'&&/^[=+@\t\r]/.test(x)?"'"+x:String(x??'')).replaceAll('"','""')+'"').join(',')).join('\r\n');
