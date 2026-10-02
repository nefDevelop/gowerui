export namespace main {
	
	export class AppContext {
	    cache_path: string;
	    config_path: string;
	    user_home: string;
	
	    static createFrom(source: any = {}) {
	        return new AppContext(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cache_path = source["cache_path"];
	        this.config_path = source["config_path"];
	        this.user_home = source["user_home"];
	    }
	}
	export class GowerStatus {
	    resolved_path: string;
	    configured_path: string;
	    available: boolean;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new GowerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.resolved_path = source["resolved_path"];
	        this.configured_path = source["configured_path"];
	        this.available = source["available"];
	        this.error = source["error"];
	    }
	}

}

