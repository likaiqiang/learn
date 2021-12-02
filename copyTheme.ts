import copydir from 'copy-dir'
import Path from 'path'

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
        copydir.sync(fromDir,toDir)
    }
}

new Copy('hexo-theme-butterfly','butterfly')

