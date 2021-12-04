import copydir from 'copy-dir'
import Path from 'path'
import directoryExists from 'directory-exists'
import fs from 'fs'
import yaml from 'js-yaml'

class Copy{
    protected moduleName:string
    protected themeName:string
    constructor(moduleName:string,themeName:string) {
        this.moduleName = moduleName
        this.themeName = themeName
        this.action()
    }
    public action(){
        const fromDir = Path.join(__dirname,'./node_modules/' + this.moduleName)
        const toDir = Path.join(__dirname,'./themes/' + this.themeName)
        directoryExists(Path.resolve('./themes'),function (err,result){
            if(!result){
                fs.mkdirSync(toDir,{recursive: true})
            }
            copydir(fromDir,toDir,{
                utimes: true,
                mode: true,
                cover: true
            })
        })
    }
}

class ReadConfig{
    protected configPath:string;
    constructor(path:string) {
        this.configPath = path
    }
    public action(){
        try{
            return yaml.load(fs.readFileSync(this.configPath,'utf-8'))
        } catch (e){
            return {}
        }
    }
}

const theme = new ReadConfig(Path.join(__dirname,'./_config.yml')).action().theme || 'butterfly'

new Copy(`hexo-theme-${theme}`,theme)
