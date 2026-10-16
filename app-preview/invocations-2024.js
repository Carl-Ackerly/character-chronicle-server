/* Original reminders; eligibility and count follow the 2024 Warlock feature table. */
(function(){const V=window.ClassRules2024;
const entries=[
 ['Agonizing Blast',2,'','Add Charisma to damage rolls of the chosen damaging Warlock cantrip.',true],
 ['Armor of Shadows',1,'','Cast Mage Armor on yourself without a slot.'],
 ['Ascendant Step',5,'','Cast Levitate on yourself without a slot.'],
 ['Devil’s Sight',2,'','See normally in magical and nonmagical darkness within 120 feet.'],
 ['Devouring Blade',12,'Thirsting Blade','Your pact-weapon Extra Attack grants two extra attacks.'],
 ['Eldritch Mind',1,'','Advantage on Constitution saves to maintain Concentration.'],
 ['Eldritch Smite',5,'Pact of the Blade','Once per turn, spend a Pact slot on a pact-weapon hit for Force damage: 1d8 + 1d8 per slot level; Huge-or-smaller targets may fall Prone.'],
 ['Eldritch Spear',2,'','Choose a damaging Warlock cantrip with range at least 10 feet; its range gains 30 × Warlock level feet.',true],
 ['Fiendish Vigor',2,'','Cast False Life on yourself without a slot; maximize its temporary-HP die.'],
 ['Gaze of Two Minds',5,'','Bonus Action: touch a willing creature to share senses; maintain with later Bonus Actions. Within 60 feet, spells may originate from either space.'],
 ['Gift of the Depths',5,'','Breathe underwater and gain a Swim Speed equal to Speed. One free Water Breathing per Long Rest.'],
 ['Gift of the Protectors',9,'Pact of the Tome','Your Book can hold Charisma-modifier names, minimum one. Once per Long Rest a named creature dropping to 0 instead stays at 1 HP.'],
 ['Investment of the Chain Master',5,'Pact of the Chain','Your familiar gains Fly/Swim Speed 40, Bonus Action attack commands, optional Necrotic/Radiant damage, your save DC, and Reaction damage resistance.'],
 ['Lessons of the First Ones',2,'','Choose an Origin feat; each repeat must choose a different feat.',true],
 ['Lifedrinker',9,'Pact of the Blade','Once per turn, a pact-weapon hit adds 1d6 Necrotic, Psychic, or Radiant; you may spend a Hit Die to heal by its roll plus Constitution.'],
 ['Mask of Many Faces',2,'','Cast Disguise Self without a slot.'],
 ['Master of Myriad Forms',5,'','Cast Alter Self without a slot.'],
 ['Misty Visions',2,'','Cast Silent Image without a slot.'],
 ['One with Shadows',5,'','In dim light or darkness, cast Invisibility on yourself without a slot.'],
 ['Otherworldly Leap',2,'','Cast Jump on yourself without a slot.'],
 ['Pact of the Blade',1,'','Bonus Action: conjure or bond a pact weapon. You may use Charisma for its attacks and choose Necrotic, Psychic, Radiant, or normal damage.'],
 ['Pact of the Chain',1,'','Know Find Familiar and cast it as a Magic action without a slot. Your familiar can use the feature’s special forms.'],
 ['Pact of the Tome',1,'','After a Short or Long Rest, conjure a Book holding three cantrips and two level-1 rituals from any classes, excluding spells already prepared. They function as Warlock spells while you carry it.'],
 ['Repelling Blast',2,'','Choose an attack-roll Warlock cantrip; its hit can push a Large-or-smaller creature 10 feet.',true],
 ['Thirsting Blade',5,'Pact of the Blade','Your pact weapon can attack twice with the Attack action.'],
 ['Visions of Distant Realms',9,'','Cast Arcane Eye without a slot.'],
 ['Whispers of the Grave',7,'','Cast Speak with Dead without a slot.'],
 ['Witch Sight',15,'','Gain Truesight within 30 feet.']
];
V.invocations=entries;V.invocationCount=n=>n>=18?10:n>=15?9:n>=12?8:n>=9?7:n>=7?6:n>=5?5:n>=2?3:1;
V.invocationOptions=(c,n)=>{const selected=c.sheet?.classChoices?.['Warlock:invocations']||[];return entries.filter(e=>n>=e[1]&&(!e[2]||selected.includes(e[2]))).map(e=>e[0])};
const oldRows=V.referenceRows;V.referenceRows=c=>{const out=oldRows(c),row=c.classes.find(r=>r.name==='Warlock');if(row){const selected=c.sheet?.classChoices?.['Warlock:invocations']||[],options=V.invocationOptions(c,row.level);selected.slice(0,V.invocationCount(row.level)).forEach((name,i)=>{const entry=entries.find(e=>e[0]===name);if(entry)out.push({id:'invocation:'+i,name:name+(c.sheet?.invocationDetails?.[i]?' · '+c.sheet.invocationDetails[i]:''),description:entry[3]+(options.includes(name)?'':' This selection currently needs prerequisite review.'),group:'Warlock'})})}return out};
V.invocationSpellNames=c=>{const row=c.classes.find(r=>r.name==='Warlock');if(!row)return [];const selected=(c.sheet?.classChoices?.['Warlock:invocations']||[]).slice(0,V.invocationCount(row.level)).filter(n=>V.invocationOptions(c,row.level).includes(n)),map={'Armor of Shadows':'Mage Armor','Ascendant Step':'Levitate','Fiendish Vigor':'False Life','Gift of the Depths':'Water Breathing','Mask of Many Faces':'Disguise Self','Master of Myriad Forms':'Alter Self','Misty Visions':'Silent Image','One with Shadows':'Invisibility','Otherworldly Leap':'Jump','Pact of the Chain':'Find Familiar','Visions of Distant Realms':'Arcane Eye','Whispers of the Grave':'Speak with Dead'},names=selected.map(n=>map[n]).filter(Boolean);if(selected.includes('Pact of the Tome'))names.push(...c.sheet?.classChoices?.['Warlock:tome-cantrips']||[],...c.sheet?.classChoices?.['Warlock:tome-rituals']||[]);return names};
const oldGrants=V.grantedNames;V.grantedNames=(c,row)=>[...oldGrants(c,row),...(row.name==='Warlock'?V.invocationSpellNames(c):[])];
})();
