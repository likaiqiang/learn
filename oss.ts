const OSS = require('ali-oss')
const path = require('path')
const fs = require('fs')

console.log("start oss");

interface Config{
    region: String,
    accessKeyId: String,
    accessKeySecret: String,
    bucket:String
}


class Client extends OSS{
    protected readonly entry:string;
    constructor(config:Config,entry:string) {
        super(config);
        this.entry = entry
        this.init()
    }
    protected searchFolder(folder:String,callback:(p:String)=>void):void{
        if(typeof folder === 'undefined'){
            folder = path.join(__dirname,'./public')
        }
        if(fs.statSync(folder).isFile()){
            callback(folder)
            return
        }
        fs.readdir(folder,(err,paths)=>{
            for(let p of paths){
                const lastP = path.join(folder,`${p}`)
                fs.stat(lastP,(error, stats)=>{
                    if(!err){
                        if(stats.isFile()){
                            typeof callback === 'function' && callback(lastP)
                        }
                        else {
                            this.searchFolder(lastP,callback)
                        }
                    } else {
                        console.error(err)
                    }
                })
            }
        })
    }
    public init():void{
        this.searchFolder(entry,(p)=>{
            const relativePath = path.relative(entry,p)
            const lastP = '/' +  relativePath.split(path.sep).join('/')
            this.put(lastP, fs.createReadStream(p)).then((result) => {
                console.log('done');
            });
        })
    }
}

const entry = path.join(__dirname,'./public')

const {
    BUCKET,
    REGION,
    ACCESSKEYSECRET,
    ACCESSKEYID
} = process.env
console.log("start oss2",JSON.stringify(process.env));

new Client({
    region: REGION,
    accessKeyId: ACCESSKEYID,
    accessKeySecret: ACCESSKEYSECRET,
    bucket: BUCKET
},entry)
