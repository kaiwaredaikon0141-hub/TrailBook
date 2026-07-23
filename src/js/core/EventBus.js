export class EventBus{
constructor(){this.events=new Map();}
on(n,f){(this.events.get(n)||this.events.set(n,[]).get(n)).push(f);}
emit(n,d){(this.events.get(n)||[]).forEach(f=>f(d));}
}