import path from "path";
import { ComponentResourceOptions, Output } from "@pulumi/pulumi";
import { SsrSite, SsrSiteArgs } from "./ssr-site.js";
import { readFileSync } from "fs";

export interface NuxtArgs extends SsrSiteArgs {
  /**
   * Configure how this component works in `sst dev`.
   *
   * :::note
   * In `sst dev` your Nuxt app is run in dev mode; it's not deployed.
   * :::
   *
   * Instead of deploying your Nuxt app, this starts it in dev mode. It's run
   * as a separate process in the `sst dev` multiplexer. Read more about
   * [`sst dev`](/docs/reference/cli/#dev).
   *
   * To disable dev mode, pass in `false`.
   */
  dev?: SsrSiteArgs["dev"];
  /**
   * Permissions and the resources that the [server function](#nodes-server) in your Nuxt app needs to access. These permissions are used to create the function's IAM role.
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
   * By default, a standalone CloudFront distribution is created for your Nuxt app.
   *
   * Alternatively, you can pass in `false` and add the app as a route to the Router
   * component.
   *
   * @default `true`
   * @example
   * ```js
   * {
   *   cdn: false
   * }
   * ```
   */
  cdn?: SsrSiteArgs["cdn"];
  /**
   * Path to the directory where your Nuxt app is located.  This path is relative to your `sst.config.ts`.
   *
   * By default it assumes your Nuxt app is in the root of your SST app.
   * @default `"."`
   *
   * @example
   *
   * If your Nuxt app is in a package in your monorepo.
   *
   * ```js
   * {
   *   path: "packages/web"
   * }
   * ```
   */
  path?: SsrSiteArgs["path"];
  /**
   * [Link resources](/docs/linking/) to your Nuxt app. This will:
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
   * Configure how the CloudFront cache invalidations are handled. This is run after your Nuxt app has been deployed.
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
   * Set [environment variables](https://cli.vuejs.org/guide/mode-and-env.html) in your Nuxt
   * app. These are made available:
   *
   * 1. In `nuxt build`, they are loaded into `process.env`.
   * 2. Locally while running through `sst dev`.
   *
   * :::tip
   * You can also `link` resources to your Nuxt app and access them in a type-safe way with the [SDK](/docs/reference/sdk/). We recommend linking since it's more secure.
   * :::
   *
   * Recall that in Vue, you need to prefix your environment variables with `VUE_APP_` to access these in the browser. [Read more here](https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code).
   *
   * @example
   * ```js
   * {
   *   environment: {
   *     API_URL: api.url,
   *     // Accessible in the browser
   *     VUE_APP_STRIPE_PUBLISHABLE_KEY: "pk_test_123"
   *   }
   * }
   * ```
   */
  environment?: SsrSiteArgs["environment"];
  /**
   * Set a custom domain for your Nuxt app.
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
   * The command used internally to build your Nuxt app.
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
   * Configure how the Nuxt app assets are uploaded to S3.
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
   * Configure the [server function](#nodes-server) in your Nuxt app to connect
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
   * Configure the Nuxt app to use an existing CloudFront cache policy.
   *
   * :::note
   * CloudFront has a limit of 20 cache policies per account, though you can request a limit
   * increase.
   * :::
   *
   * By default, a new cache policy is created for it. This allows you to reuse an existing
   * policy instead of creating a new one.
   *
   * @default A new cache policy is created
   *
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
 * The `Nuxt` component lets you deploy a [Nuxt](https://nuxt.com) app to AWS.
 *
 * @example
 *
 * #### Minimal example
 *
 * Deploy a Nuxt app that's in the project root.
 *
 * ```js title="sst.config.ts"
 * new sst.aws.Nuxt("MyWeb");
 * ```
 *
 * #### Change the path
 *
 * Deploys the Nuxt app in the `my-nuxt-app/` directory.
 *
 * ```js {2} title="sst.config.ts"
 * new sst.aws.Nuxt("MyWeb", {
 *   path: "my-nuxt-app/"
 * });
 * ```
 *
 * #### Add a custom domain
 *
 * Set a custom domain for your Nuxt app.
 *
 * ```js {2} title="sst.config.ts"
 * new sst.aws.Nuxt("MyWeb", {
 *   domain: "my-app.com"
 * });
 * ```
 *
 * #### Redirect www to apex domain
 *
 * Redirect `www.my-app.com` to `my-app.com`.
 *
 * ```js {4} title="sst.config.ts"
 * new sst.aws.Nuxt("MyWeb", {
 *   domain: {
 *     name: "my-app.com",
 *     redirects: ["www.my-app.com"]
 *   }
 * });
 * ```
 *
 * #### Link resources
 *
 * [Link resources](/docs/linking/) to your Nuxt app. This will grant permissions
 * to the resources and allow you to access it in your app.
 *
 * ```ts {4} title="sst.config.ts"
 * const bucket = new sst.aws.Bucket("MyBucket");
 *
 * new sst.aws.Nuxt("MyWeb", {
 *   link: [bucket]
 * });
 * ```
 *
 * You can use the [SDK](/docs/reference/sdk/) to access the linked resources
 * in your Nuxt app.
 *
 * ```ts title="server/api/index.ts"
 * import { Resource } from "sst";
 *
 * console.log(Resource.MyBucket.name);
 * ```
 *
 * #### Configure base path
 *
 * To serve your Nuxt app from a subpath (e.g., `https://my-app.com/docs`), you need to configure both Nuxt and SST settings.
 *
 * Step 1: Configure Nuxt base path
 *
 * Set the `baseURL` option in your Nuxt app's `nuxt.config.ts` without a trailing slash:
 * ```js {3} title="nuxt.config.ts"
 * export default defineConfig({
 *   app: {
 *     baseURL: "/docs",
 *   },
 * });
 * ```
 *
 * Step 2: Disable CDN on the Nuxt component
 *
 * In your SST configuration:
 * ```js {2} title="sst.config.ts"
 * const docs = new sst.aws.Nuxt("Docs", {
 *   cdn: false,
 * });
 * ```
 *
 * Step 3: Add the site to a Router
 *
 * Finally, route the Nuxt app through a Router component:
 * ```js {2}
 * const router = new sst.aws.Router("MyRouter", {
 *   domain: "my-app.com",
 * });
 * router.routeSite("/docs", docs);
 * ```
 */
export class Nuxt extends SsrSite {
  constructor(
    name: string,
    args: NuxtArgs = {},
    opts: ComponentResourceOptions = {},
  ) {
    super(__pulumiType, name, args, opts);
  }

  protected normalizeBuildCommand() {}

  protected buildPlan(outputPath: Output<string>) {
    return outputPath.apply((outputPath) => {
      const basepath = readFileSync(
        path.join(outputPath, "nuxt.config.ts"),
        "utf-8",
      ).match(/baseURL: ['"](.*)['"]/)?.[1];

      return {
        base: basepath,
        server: {
          description: "Server handler for Nuxt",
          handler: "index.handler",
          bundle: path.join(outputPath, ".output", "server"),
        },
        assets: [
          {
            from: path.join(".output", "public"),
            to: "",
            cached: true,
          },
        ],
      };
    });
  }

  /**
   * The URL of the Nuxt app.
   *
   * If the `domain` is set, this is the URL with the custom domain.
   * Otherwise, it's the autogenerated CloudFront URL.
   */
  public get url() {
    return super.url;
  }
}

const __pulumiType = "sst:aws:Nuxt";
// @ts-expect-error
Nuxt.__pulumiType = __pulumiType;
