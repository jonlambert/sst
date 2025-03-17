import fs from "fs";
import path from "path";
import {
  ComponentResourceOptions,
  Output,
  all,
  interpolate,
} from "@pulumi/pulumi";
import { Function } from "./function.js";
import {
  SsrSiteArgs,
  createDevResources,
  createResources,
  prepare,
  validatePlan,
} from "./ssr-site-new.js";
import { Cdn } from "./cdn.js";
import { Bucket } from "./bucket.js";
import { Component } from "../component.js";
import { Link } from "../link.js";
import { buildApp } from "../base/base-ssr-site.js";

export interface ReactArgs extends SsrSiteArgs {
  /**
   * Configure how this component works in `sst dev`.
   *
   * :::note
   * In `sst dev` your React app is run in dev mode; it's not deployed.
   * :::
   *
   * Instead of deploying your React app, this starts it in dev mode. It's run
   * as a separate process in the `sst dev` multiplexer. Read more about
   * [`sst dev`](/docs/reference/cli/#dev).
   *
   * To disable dev mode, pass in `false`.
   */
  dev?: SsrSiteArgs["dev"];
  /**
   * Permissions and the resources that the [server function](#nodes-server) in your React app needs to access. These permissions are used to create the function's IAM role.
   *
   * :::tip
   * If you `link` the function to a resource, the permissions to access it are
   * automatically added.
   * :::
   *
   * @example
   * Allow reading and writing to an S3 bucket called `my-bucket`.
   * ```js
   * {
   *   permissions: [
   *     {
   *       actions: ["s3:GetObject", "s3:PutObject"],
   *       resources: ["arn:aws:s3:::my-bucket/*"]
   *     },
   *   ]
   * }
   * ```
   *
   * Perform all actions on an S3 bucket called `my-bucket`.
   *
   * ```js
   * {
   *   permissions: [
   *     {
   *       actions: ["s3:*"],
   *       resources: ["arn:aws:s3:::my-bucket/*"]
   *     },
   *   ]
   * }
   * ```
   *
   * Grant permissions to access all resources.
   *
   * ```js
   * {
   *   permissions: [
   *     {
   *       actions: ["*"],
   *       resources: ["*"]
   *     },
   *   ]
   * }
   * ```
   */
  permissions?: SsrSiteArgs["permissions"];
  /**
   * The regions that the [server function](#nodes-server) in your Astro site will be
   * deployed to. Requests will be routed to the nearest region based on the user's location.
   *
   * @default The default region of the SST app
   * @example
   * ```js
   * {
   *   regions: ["us-east-1", "eu-west-1"]
   * }
   * ```
   */
  regions?: SsrSiteArgs["regions"];
  /**
   * Path to the directory where your React app is located.  This path is relative to your `sst.config.ts`.
   *
   * By default it assumes your React app is in the root of your SST app.
   * @default `"."`
   *
   * @example
   *
   * If your React app is in a package in your monorepo.
   *
   * ```js
   * {
   *   path: "packages/web"
   * }
   * ```
   */
  path?: SsrSiteArgs["path"];
  /**
   * [Link resources](/docs/linking/) to your React app. This will:
   *
   * 1. Grant the permissions needed to access the resources.
   * 2. Allow you to access it in your site using the [SDK](/docs/reference/sdk/).
   *
   * @example
   *
   * Takes a list of resources to link to the function.
   *
   * ```js
   * {
   *   link: [bucket, stripeKey]
   * }
   * ```
   */
  link?: SsrSiteArgs["link"];
  /**
   * Configure how the CloudFront cache invalidations are handled. This is run after your React app has been deployed.
   * :::tip
   * You get 1000 free invalidations per month. After that you pay $0.005 per invalidation path. [Read more here](https://aws.amazon.com/cloudfront/pricing/).
   * :::
   * @default `{paths: "all", wait: false}`
   * @example
   * Wait for all paths to be invalidated.
   * ```js
   * {
   *   invalidation: {
   *     paths: "all",
   *     wait: true
   *   }
   * }
   * ```
   */
  invalidation?: SsrSiteArgs["invalidation"];
  /**
   * Set environment variables in your React app through
   * [Vite](https://vitejs.dev/guide/env-and-mode). These are made available:
   *
   * 1. In `react-router build`, by loading them into `process.env`.
   * 2. Locally while running `react-router dev` through `sst dev`.
   *
   * :::tip
   * You can also `link` resources to your React app and access them in a type-safe way with the [SDK](/docs/reference/sdk/). We recommend linking since it's more secure.
   * :::
   *
   * @example
   * ```js
   * {
   *   environment: {
   *     API_URL: api.url,
   *     STRIPE_PUBLISHABLE_KEY: "pk_test_123"
   *   }
   * }
   * ```
   */
  environment?: SsrSiteArgs["environment"];
  /**
   * Set a custom domain for your React app.
   *
   * Automatically manages domains hosted on AWS Route 53, Cloudflare, and Vercel. For other
   * providers, you'll need to pass in a `cert` that validates domain ownership and add the
   * DNS records.
   *
   * :::tip
   * Built-in support for AWS Route 53, Cloudflare, and Vercel. And manual setup for other
   * providers.
   * :::
   *
   * @example
   *
   * By default this assumes the domain is hosted on Route 53.
   *
   * ```js
   * {
   *   domain: "example.com"
   * }
   * ```
   *
   * For domains hosted on Cloudflare.
   *
   * ```js
   * {
   *   domain: {
   *     name: "example.com",
   *     dns: sst.cloudflare.dns()
   *   }
   * }
   * ```
   *
   * Specify a `www.` version of the custom domain.
   *
   * ```js
   * {
   *   domain: {
   *     name: "domain.com",
   *     redirects: ["www.domain.com"]
   *   }
   * }
   * ```
   */
  domain?: SsrSiteArgs["domain"];
  /**
   * The command used internally to build your React app.
   *
   * @default `"npm run build"`
   *
   * @example
   *
   * If you want to use a different build command.
   * ```js
   * {
   *   buildCommand: "yarn build"
   * }
   * ```
   */
  buildCommand?: SsrSiteArgs["buildCommand"];
  /**
   * Configure how the React app assets are uploaded to S3.
   *
   * By default, this is set to the following. Read more about these options below.
   * ```js
   * {
   *   assets: {
   *     textEncoding: "utf-8",
   *     versionedFilesCacheHeader: "public,max-age=31536000,immutable",
   *     nonVersionedFilesCacheHeader: "public,max-age=0,s-maxage=86400,stale-while-revalidate=8640"
   *   }
   * }
   * ```
   */
  assets?: SsrSiteArgs["assets"];
  /**
   * Configure the [server function](#nodes-server) in your React app to connect
   * to private subnets in a virtual private cloud or VPC. This allows your app to
   * access private resources.
   *
   * @example
   * ```js
   * {
   *   vpc: {
   *     securityGroups: ["sg-0399348378a4c256c"],
   *     subnets: ["subnet-0b6a2b73896dc8c4c", "subnet-021389ebee680c2f0"]
   *   }
   * }
   * ```
   */
  vpc?: SsrSiteArgs["vpc"];
  /**
   * Configure the React app to use an existing CloudFront cache policy. By default,
   * a new cache policy is created. Note that CloudFront has a limit of 20 cache
   * policies per account. This allows you to reuse an existing policy instead of
   * creating a new one.
   * @default A new cache policy is created
   * @example
   * ```js
   * {
   *   cachePolicy: "658327ea-f89d-4fab-a63d-7e88639e58f6"
   * }
   * ```
   */
  cachePolicy?: SsrSiteArgs["cachePolicy"];
}

/**
 * The `React` component lets you deploy a React app built with
 * [React Router v7](https://reactrouter.com/) to AWS. It supports SPA mode, SSR
 * mode, and prerendered routes.
 *
 * @example
 *
 * #### Minimal example
 *
 * Deploy a React app that's in the project root.
 *
 * ```js
 * new sst.aws.React("MyWeb");
 * ```
 *
 * #### Change the path
 *
 * Deploys the React app in the `my-react-app/` directory.
 *
 * ```js {2}
 * new sst.aws.React("MyWeb", {
 *   path: "my-react-app/"
 * });
 * ```
 *
 * #### Add a custom domain
 *
 * Set a custom domain for your React app.
 *
 * ```js {2}
 * new sst.aws.React("MyWeb", {
 *   domain: "my-app.com"
 * });
 * ```
 *
 * #### Redirect www to apex domain
 *
 * Redirect `www.my-app.com` to `my-app.com`.
 *
 * ```js {4}
 * new sst.aws.React("MyWeb", {
 *   domain: {
 *     name: "my-app.com",
 *     redirects: ["www.my-app.com"]
 *   }
 * });
 * ```
 *
 * #### Link resources
 *
 * [Link resources](/docs/linking/) to your React app. This will grant permissions
 * to the resources and allow you to access it in your app.
 *
 * ```ts {4}
 * const bucket = new sst.aws.Bucket("MyBucket");
 *
 * new sst.aws.React("MyWeb", {
 *   link: [bucket]
 * });
 * ```
 *
 * You can use the [SDK](/docs/reference/sdk/) to access the linked resources
 * in your React app.
 *
 * ```ts title="app/root.tsx"
 * import { Resource } from "sst";
 *
 * console.log(Resource.MyBucket.name);
 * ```
 */
export class React extends Component implements Link.Linkable {
  private cdn?: Output<Cdn>;
  private assets?: Bucket;
  private server?: Output<Function>;
  private devUrl?: Output<string>;

  constructor(
    name: string,
    args: ReactArgs = {},
    opts: ComponentResourceOptions = {},
  ) {
    super(__pulumiType, name, args, opts);

    const parent = this;
    const { dev, sitePath, regions } = prepare(parent, args);

    if (dev.enabled) {
      const { server } = createDevResources(parent, name, args);
      this.devUrl = dev.url;
      this.registerOutputs({
        _metadata: {
          mode: "placeholder",
          path: sitePath,
          server: server.arn,
        },
        _dev: {
          ...dev.outputs,
          aws: { role: server.nodes.role.arn },
        },
      });
      return;
    }

    const outputPath = buildApp(parent, name, args, sitePath);
    const buildMeta = loadBuildMetadata();
    const plan = buildPlan();
    const { distribution, bucket, servers } = createResources(
      parent,
      name,
      args,
      outputPath,
      plan,
      regions,
    );
    const server = servers.apply((servers) => servers[0]);

    this.assets = bucket;
    this.cdn = distribution;
    this.server = server;
    this.registerOutputs({
      _hint: all([this.cdn.domainUrl, this.cdn.url]).apply(
        ([domainUrl, url]) => domainUrl ?? url,
      ),
      _metadata: {
        mode: "deployed",
        path: sitePath,
        url: distribution.apply((d) => d.domainUrl ?? d.url),
        edge: false,
        server: server.arn,
      },
      _dev: {
        ...dev.outputs,
        aws: { role: server.nodes.role.arn },
      },
    });

    function loadBuildMetadata() {
      return outputPath.apply((outputPath) => {
        const assetsPath = path.join("build", "client");
        const serverPath = path.join("build", "server");
        return {
          assetsPath,
          serverPath: fs.existsSync(path.join(outputPath, serverPath))
            ? serverPath
            : undefined,
        };
      });
    }

    function buildPlan() {
      return all([outputPath, buildMeta]).apply(([outputPath, buildMeta]) => {
        const indexPage = "index.html";
        return validatePlan({
          server: buildMeta.serverPath
            ? createServerLambdaBundle(outputPath)
            : undefined,
          s3: {
            copy: [
              {
                from: buildMeta.assetsPath,
                to: "",
                cached: true,
              },
            ],
          },
          errorResponses: buildMeta.serverPath
            ? []
            : [
              {
                errorCode: 403,
                responsePagePath: interpolate`/${indexPage}`,
                responseCode: 200,
              },
              {
                errorCode: 404,
                responsePagePath: interpolate`/${indexPage}`,
                responseCode: 200,
              },
            ],
        });
      });
    }

    function createServerLambdaBundle(outputPath: string) {
      // React does perform their own internal ESBuild process, but it doesn't bundle
      // 3rd party dependencies by default. In the interest of keeping deployments
      // seamless for users we will create a server bundle with all dependencies included.

      fs.copyFileSync(
        path.join(
          $cli.paths.platform,
          "functions",
          "react-server",
          "server.mjs",
        ),
        path.join(outputPath, "build", "server.mjs"),
      );

      return {
        handler: path.join(outputPath, "build", "server.handler"),
        streaming: true,
      };
    }
  }

  /**
   * The URL of the React app.
   *
   * If the `domain` is set, this is the URL with the custom domain.
   * Otherwise, it's the autogenerated CloudFront URL.
   */
  public get url() {
    return all([this.cdn?.domainUrl, this.cdn?.url, this.devUrl]).apply(
      ([domainUrl, url, dev]) => domainUrl ?? url ?? dev!,
    );
  }

  /**
   * The underlying [resources](/docs/components/#nodes) this component creates.
   */
  public get nodes() {
    return {
      /**
       * The AWS Lambda server function that renders the site.
       */
      server: this.server,
      /**
       * The Amazon S3 Bucket that stores the assets.
       */
      assets: this.assets,
      /**
       * The Amazon CloudFront CDN that serves the app.
       */
      cdn: this.cdn,
    };
  }

  /** @internal */
  public getSSTLink() {
    return {
      properties: {
        url: this.url,
      },
    };
  }
}

const __pulumiType = "sst:aws:React";
// @ts-expect-error
React.__pulumiType = __pulumiType;
