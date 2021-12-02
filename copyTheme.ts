import copydir from 'copy-dir'
import Path from 'path'
import directoryExists from 'directory-exists'
import fs from 'fs'

class Copy{
    protected moduleName:string
    protected themeName:string
    constructor(moduleName:string,themeName:string) {
        this.moduleName = moduleName
        this.themeName = themeName
        this.action()
    }
    public action(){
        const fromDir = Path.resolve('./node_modules/' + this.moduleName)
        const toDir = Path.resolve('./themes/' + this.themeName)
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

new Copy('hexo-theme-butterfly','butterfly')

